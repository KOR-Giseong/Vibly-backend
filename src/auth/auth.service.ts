import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import * as bcrypt from 'bcryptjs';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthProvider } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private http: HttpService,
  ) {}

  // ── Email Auth ─────────────────────────────────────────────────────────────

  async emailSignup(email: string, password: string, name: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('이미 사용 중인 이메일이에요.');

    const hash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: { email, name, provider: AuthProvider.EMAIL, passwordHash: hash },
    });
    return this.issueTokens(user.id);
  }

  async emailLogin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('이메일 또는 비밀번호가 맞지 않아요.');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('이메일 또는 비밀번호가 맞지 않아요.');
    return this.issueTokens(user.id);
  }

  // ── Google Auth ────────────────────────────────────────────────────────────

  async googleLogin(code: string, redirectUri: string) {
    try {
      const { data: tokenData } = await firstValueFrom(
        this.http.post('https://oauth2.googleapis.com/token', {
          code,
          client_id: this.config.get('GOOGLE_CLIENT_ID'),
          client_secret: this.config.get('GOOGLE_CLIENT_SECRET'),
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      );

      // id_token은 JWT - 페이로드 디코딩
      const payload = JSON.parse(
        Buffer.from(tokenData.id_token.split('.')[1], 'base64').toString(),
      );
      const { sub, email, name, given_name } = payload;
      return this.upsertSocialUser(AuthProvider.GOOGLE, sub, email ?? null, name ?? given_name ?? 'Google 사용자');
    } catch {
      throw new BadRequestException('Google 로그인에 실패했어요.');
    }
  }

  // ── Kakao Auth ─────────────────────────────────────────────────────────────

  async kakaoLogin(code: string, redirectUri: string) {
    try {
      // 1. 인가 코드 → 액세스 토큰 교환
      const { data: tokenData } = await firstValueFrom(
        this.http.post(
          'https://kauth.kakao.com/oauth/token',
          new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.config.get<string>('KAKAO_REST_API_KEY') ?? '',
            redirect_uri: redirectUri,
            code,
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );

      // 2. 액세스 토큰 → 사용자 정보
      const { data: userInfo } = await firstValueFrom(
        this.http.get('https://kapi.kakao.com/v2/user/me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }),
      );

      const id = String(userInfo.id);
      const email = userInfo.kakao_account?.email ?? null;
      const name = userInfo.kakao_account?.profile?.nickname ?? '카카오 사용자';
      return this.upsertSocialUser(AuthProvider.KAKAO, id, email, name);
    } catch {
      throw new BadRequestException('카카오 로그인에 실패했어요.');
    }
  }

  // ── Apple Auth ─────────────────────────────────────────────────────────────

  async appleLogin(idToken: string) {
    try {
      // Apple identity token은 JWT - 페이로드 디코딩 (서명 검증 생략, 프로덕션에서는 추가)
      const payload = JSON.parse(
        Buffer.from(idToken.split('.')[1], 'base64url').toString(),
      );
      const { sub, email } = payload;
      if (!sub) throw new Error('sub 없음');
      return this.upsertSocialUser(AuthProvider.APPLE, sub, email ?? null, 'Apple 사용자');
    } catch {
      throw new BadRequestException('Apple 로그인에 실패했어요.');
    }
  }

  // ── Social 공통 ────────────────────────────────────────────────────────────

  private async upsertSocialUser(
    provider: AuthProvider,
    providerId: string,
    email: string | null,
    name: string,
  ) {
    let user = await this.prisma.user.findFirst({ where: { provider, providerId } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { provider, providerId, email, name },
      });
    }
    return this.issueTokens(user.id);
  }

  // ── Token ──────────────────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('토큰이 없어요.');
    const record = await this.prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!record || record.expiresAt < new Date()) throw new UnauthorizedException('토큰이 만료됐어요.');
    return this.issueTokens(record.userId);
  }

  async logout(userId: string, refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId, token: refreshToken } });
  }

  private async issueTokens(userId: string) {
    const accessToken = this.jwt.sign({ sub: userId }, { expiresIn: '15m' });
    const refreshToken = this.jwt.sign({ sub: userId }, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { userId, token: refreshToken, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        preferredVibes: true,
        isProfileComplete: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async checkNickname(nickname: string, userId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { nickname, NOT: { id: userId } },
    });
    return { available: !existing };
  }

  async updateProfile(userId: string, data: { nickname: string; preferredVibes: string[] }) {
    const taken = await this.prisma.user.findFirst({
      where: { nickname: data.nickname, NOT: { id: userId } },
    });
    if (taken) throw new ConflictException('이미 사용 중인 닉네임이에요.');
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: data.nickname,
        preferredVibes: data.preferredVibes,
        isProfileComplete: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        preferredVibes: true,
        isProfileComplete: true,
        status: true,
        createdAt: true,
      },
    });
  }
}

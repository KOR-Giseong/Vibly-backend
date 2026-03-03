import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthProvider } from '@prisma/client';
import { CreditService } from '../credit/credit.service';
import { R2Service } from '../storage/r2.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private http: HttpService,
    private creditService: CreditService,
    private r2: R2Service,
  ) {
    if (!config.get<string>('JWT_REFRESH_SECRET')) {
      throw new Error('JWT_REFRESH_SECRET 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.');
    }
  }

  // ── Email Auth ─────────────────────────────────────────────────────────────

  async emailSignup(email: string, password: string, name: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('이미 사용 중인 이메일이에요.');
    }

    // 30일 재가입 제한 확인
    const deleted = await this.prisma.deletedAccount.findFirst({
      where: { email, canRejoinAt: { gt: new Date() } },
    });
    if (deleted) {
      const days = Math.ceil((deleted.canRejoinAt.getTime() - Date.now()) / 86400000);
      throw new ConflictException(`탈퇴 후 30일간 재가입이 제한돼요. ${days}일 후에 다시 시도해 주세요.`);
    }

    const hash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: { email, name, provider: AuthProvider.EMAIL, passwordHash: hash, emailVerified: true },
    });

    this.creditService.grantSignupBonus(user.id).catch(() => {});
    return this.issueTokens(user.id);
  }

  async emailLogin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new NotFoundException('등록되지 않은 이메일이에요.');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('비밀번호가 맞지 않아요.');
    // 로그인은 비밀번호만 맞으면 바로 토큰 발급 (OTP는 회원가입 시에만)
    return this.issueTokens(user.id);
  }

  // ── Google Auth ────────────────────────────────────────────────────────────

  async googleLogin(codeOrIdToken: string, redirectUri: string, codeVerifier?: string) {
    try {
      let idTokenString: string;

      const tokenInput = (codeOrIdToken ?? '').trim();
      console.log('[Google Login] 수신 토큰 앞부분:', tokenInput.substring(0, 40), 'length:', tokenInput.length);

      if (tokenInput.startsWith('eyJ')) {
        // 프론트에서 이미 교환된 id_token
        idTokenString = tokenInput;
      } else {
        // authorization code → 백엔드에서 교환 (Web 클라이언트 경로)
        const body: Record<string, string> = {
          code: tokenInput,
          client_id: this.config.get('GOOGLE_CLIENT_ID') ?? '',
          client_secret: this.config.get('GOOGLE_CLIENT_SECRET') ?? '',
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        };
        if (codeVerifier) body['code_verifier'] = codeVerifier;
        const { data: tokenData } = await firstValueFrom(
          this.http.post('https://oauth2.googleapis.com/token', body),
        );
        idTokenString = tokenData.id_token;
      }

      // 1차: jwt.decode 시도
      let payload = jwt.decode(idTokenString) as { sub: string; email?: string; name?: string; given_name?: string } | null;

      // 2차: jwt.decode 실패 시 수동 base64url 디코딩
      if (!payload) {
        console.warn('[Google Login] jwt.decode 실패 - 수동 디코딩 시도');
        try {
          const parts = idTokenString.split('.');
          if (parts.length !== 3) throw new Error(`JWT 파트 수 오류: ${parts.length}`);
          const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const padded = payloadBase64.padEnd(payloadBase64.length + (4 - payloadBase64.length % 4) % 4, '=');
          payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
        } catch (decodeErr) {
          console.error('[Google Login] 수동 디코딩도 실패:', decodeErr?.message);
          throw new BadRequestException(`Google id_token 파싱 실패: ${decodeErr?.message}`);
        }
      }

      console.log('[Google Login] 디코딩 결과 sub:', payload?.sub ?? 'MISSING', 'email:', payload?.email ?? 'none');

      if (!payload?.sub) throw new BadRequestException('Google id_token에 사용자 ID(sub)가 없어요.');

      const { sub, email, name, given_name } = payload;
      return this.upsertSocialUser(AuthProvider.GOOGLE, sub, email ?? null, name ?? given_name ?? 'Google 사용자');
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof ConflictException || e instanceof UnauthorizedException) {
        throw e;
      }
      console.error('[Google Login] 예상치 못한 오류:', e?.constructor?.name, e?.message);
      throw new BadRequestException(`Google 로그인 처리 오류: ${e?.message ?? String(e)}`);
    }
  }

  // ── Kakao Auth ─────────────────────────────────────────────────────────────

  async kakaoLogin(accessToken: string) {
    try {
      // 네이티브 SDK가 access_token을 직접 반환 → user/me 바로 호출
      const { data: userInfo } = await firstValueFrom(
        this.http.get('https://kapi.kakao.com/v2/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
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

  async appleLogin(idToken: string, name?: string) {
    try {
      const { sub, email } = await this.verifyAppleToken(idToken);
      return this.upsertSocialUser(AuthProvider.APPLE, sub, email ?? null, name?.trim() || 'Apple 사용자');
    } catch {
      throw new BadRequestException('Apple 로그인에 실패했어요.');
    }
  }

  private async verifyAppleToken(idToken: string): Promise<{ sub: string; email?: string }> {
    // 1. JWT 헤더에서 kid 추출
    const [headerB64] = idToken.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString()) as { kid: string; alg: string };

    // 2. Apple JWKS 공개키 가져오기
    const { data: jwks } = await firstValueFrom(
      this.http.get<{ keys: JsonWebKey[] }>('https://appleid.apple.com/auth/keys'),
    );
    const appleKey = jwks.keys.find((k: any) => k.kid === header.kid) as crypto.JsonWebKey | undefined;
    if (!appleKey) throw new Error('일치하는 Apple 공개키가 없어요.');

    // 3. JWK → PEM 변환
    const publicKey = crypto.createPublicKey({ key: appleKey, format: 'jwk' });
    const pem = publicKey.export({ type: 'spki', format: 'pem' });

    // 4. 서명 검증 (issuer, audience 포함)
    const clientId = this.config.get<string>('APPLE_CLIENT_ID');
    const payload = jwt.verify(idToken, pem as string, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      ...(clientId ? { audience: clientId } : {}),
    }) as { sub: string; email?: string };

    if (!payload.sub) throw new Error('sub 없음');
    return payload;
  }

  // ── Social 공통 ────────────────────────────────────────────────────────────

  private async upsertSocialUser(
    provider: AuthProvider,
    providerId: string,
    email: string | null,
    name: string,
  ) {
    // 1. 동일 소셜 계정 조회
    let user = await this.prisma.user.findFirst({ where: { provider, providerId } });

    if (!user) {
      // 30일 재가입 제한 확인 (providerId 기준)
      const deletedByProvider = await this.prisma.deletedAccount.findFirst({
        where: { provider, providerId, canRejoinAt: { gt: new Date() } },
      });
      if (deletedByProvider) {
        const days = Math.ceil((deletedByProvider.canRejoinAt.getTime() - Date.now()) / 86400000);
        throw new ConflictException(`탈퇴 후 30일간 재가입이 제한돼요. ${days}일 후에 다시 시도해 주세요.`);
      }

      // 이메일이 있으면 다른 provider로 이미 가입된 계정인지 확인
      if (email) {
        const existing = await this.prisma.user.findFirst({ where: { email } });
        if (existing) {
          const PROVIDER_LABEL: Record<string, string> = {
            EMAIL: '이메일',
            GOOGLE: '구글',
            KAKAO: '카카오',
            APPLE: '애플',
          };
          const usedProvider = PROVIDER_LABEL[existing.provider] ?? existing.provider;
          throw new ConflictException(
            `이미 ${usedProvider}로 가입된 이메일이에요. ${usedProvider} 로그인을 이용해 주세요.`,
          );
        }
      }
      user = await this.prisma.user.create({
        data: { provider, providerId, email, name, emailVerified: true },
      });
      // 가입 보너스 트랜잭션 기록
      this.creditService.grantSignupBonus(user.id).catch(() => {});
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

    await this.prisma.refreshToken.upsert({
      where: { token: refreshToken },
      create: { userId, token: refreshToken, expiresAt },
      update: { expiresAt },
    });

    return { accessToken, refreshToken };
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없어요.');

    const canRejoinAt = new Date();
    canRejoinAt.setDate(canRejoinAt.getDate() + 30);

    // 탈퇴 기록 저장 (30일 재가입 제한용)
    await this.prisma.deletedAccount.create({
      data: {
        provider: user.provider,
        providerId: user.providerId,
        email: user.email,
        canRejoinAt,
      },
    });

    // 연관 데이터 모두 CASCADE 삭제
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new BadRequestException('소셜 로그인 계정은 비밀번호를 변경할 수 없어요.');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('현재 비밀번호가 맞지 않아요.');
    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    return { success: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        avatarUrl: true,
        gender: true,
        preferredVibes: true,
        isProfileComplete: true,
        status: true,
        isAdmin: true,
        suspendedUntil: true,
        suspendReason: true,
        credits: true,
        createdAt: true,
        subscriptions: {
          where: { expiresAt: { gt: new Date() } },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!user) return null;
    const { subscriptions, ...rest } = user;

    // 커플 정보 조회
    const couple = await this.prisma.couple.findFirst({
      where: { status: 'ACTIVE', OR: [{ user1Id: userId }, { user2Id: userId }] },
      include: {
        user1: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
        user2: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
      },
    });

    let coupleInfo: {
      coupleId: string; partnerId: string; partnerName: string;
      partnerAvatarUrl: string | null; creditShareEnabled: boolean;
      anniversaryDate: Date | null; createdAt: Date;
    } | null = null;
    if (couple) {
      const isUser1 = couple.user1Id === userId;
      const partner = isUser1 ? couple.user2 : couple.user1;
      coupleInfo = {
        coupleId: couple.id,
        partnerId: partner.id,
        partnerName: partner.nickname ?? partner.name,
        partnerAvatarUrl: partner.avatarUrl,
        creditShareEnabled: couple.creditShareEnabled,
        anniversaryDate: couple.anniversaryDate,
        createdAt: couple.createdAt,
      };
    }

    return { ...rest, isPremium: subscriptions.length > 0, couple: coupleInfo };
  }

  async checkNickname(nickname: string, userId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { nickname, NOT: { id: userId } },
    });
    return { available: !existing };
  }

  async updateProfile(userId: string, data: { name?: string; nickname?: string; gender?: string; preferredVibes?: string[] }) {
    if (data.nickname) {
      const taken = await this.prisma.user.findFirst({
        where: { nickname: data.nickname, NOT: { id: userId } },
      });
      if (taken) throw new ConflictException('이미 사용 중인 닉네임이에요.');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.nickname !== undefined && { nickname: data.nickname }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.preferredVibes !== undefined && { preferredVibes: data.preferredVibes }),
        isProfileComplete: true,
      },
      select: {
        id: true, email: true, name: true, nickname: true, gender: true,
        avatarUrl: true, preferredVibes: true, isProfileComplete: true,
        status: true, createdAt: true,
      },
    });
  }

  // ── 아바타 업데이트 (R2 오브젝트 스토리지) ─────────────────────────────────
  async updateAvatar(userId: string, base64: string): Promise<{ avatarUrl: string }> {
    const isPng = base64.startsWith('data:image/png');
    const ext = isPng ? 'png' : 'jpg';
    const mimeType = isPng ? 'image/png' : 'image/jpeg';

    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 이전 아바타 R2에서 삭제
    const prev = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    if (prev?.avatarUrl) {
      void this.r2.deleteByUrl(prev.avatarUrl);
    }

    const avatarUrl = await this.r2.upload(buffer, 'avatars', ext, mimeType);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    return { avatarUrl };
  }

  async resetAvatar(userId: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    if (user?.avatarUrl) {
      void this.r2.deleteByUrl(user.avatarUrl);
    }
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    return { success: true };
  }

  // ── 사용자 통계 ─────────────────────────────────────────────────────────────
  async getStats(userId: string) {
    const [checkinCount, bookmarkCount, reviewCount] = await Promise.all([
      this.prisma.checkIn.count({ where: { userId } }),
      this.prisma.bookmark.count({ where: { userId } }),
      this.prisma.review.count({ where: { userId } }),
    ]);
    return { checkinCount, bookmarkCount, reviewCount };
  }
}

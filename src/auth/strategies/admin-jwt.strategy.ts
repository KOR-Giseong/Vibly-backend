import { Injectable, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = config.get<string>('ADMIN_JWT_SECRET');
    if (!secret) throw new Error('ADMIN_JWT_SECRET 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; isAdmin: boolean }) {
    if (!payload.isAdmin) {
      throw new ForbiddenException('관리자 전용 토큰이 아닙니다.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, isAdmin: true },
    });

    if (!user?.isAdmin) {
      throw new ForbiddenException('관리자 권한이 없어요.');
    }
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('계정이 정지되었어요.');
    }

    return { id: payload.sub, isAdmin: true };
  }
}

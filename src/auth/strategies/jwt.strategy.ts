import { Injectable, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, isAdmin: true },
    });
    if (user?.status === 'SUSPENDED') {
      throw new ForbiddenException({ message: '계정이 정지되었어요.', code: 'ACCOUNT_SUSPENDED' });
    }
    return { id: payload.sub, isAdmin: user?.isAdmin ?? false };
  }
}

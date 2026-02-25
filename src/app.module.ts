import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlaceModule } from './place/place.module';
import { MoodModule } from './mood/mood.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000,  limit: 60  }, // 일반: 60회/분
      { name: 'auth',    ttl: 900_000, limit: 10  }, // 인증: 10회/15분
    ]),
    PrismaModule,
    AuthModule,
    PlaceModule,
    MoodModule,
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // Rate Limiting 전역 적용
  ],
})
export class AppModule {}

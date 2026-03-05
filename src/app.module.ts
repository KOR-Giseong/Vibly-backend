import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AppConfigModule } from './config/app-config.module';
import { AuthModule } from './auth/auth.module';
import { PlaceModule } from './place/place.module';
import { MoodModule } from './mood/mood.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SupportModule } from './support/support.module';
import { CommunityModule } from './community/community.module';
import { CreditModule } from './credit/credit.module';
import { CoupleModule } from './couple/couple.module';
import { NotificationModule } from './notification/notification.module';
import { AdminLogModule } from './admin-log/admin-log.module';
import { AdminMessageModule } from './admin-message/admin-message.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000,  limit: 120 },
      { name: 'auth',    ttl: 900_000, limit: 50  },
    ]),
    PrismaModule,
    AppConfigModule,
    AuthModule,
    PlaceModule,
    MoodModule,
    AnalyticsModule,
    SupportModule,
    CommunityModule,
    CreditModule,
    CoupleModule,
    NotificationModule,
    AdminLogModule,
    AdminMessageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // Rate Limiting 전역 적용
  ],
})
export class AppModule {}


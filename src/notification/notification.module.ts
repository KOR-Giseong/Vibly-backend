import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController, AdminNotificationController } from './notification.controller';
import { NotificationScheduler } from './notification.scheduler';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController, AdminNotificationController],
  providers: [NotificationService, NotificationScheduler],
  exports: [NotificationService],
})
export class NotificationModule {}

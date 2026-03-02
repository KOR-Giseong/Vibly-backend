import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService], // 다른 모듈에서 주입 가능
})
export class NotificationModule {}

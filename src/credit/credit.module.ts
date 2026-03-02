import { Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditController } from './credit.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [CreditController],
  providers: [CreditService],
  exports: [CreditService], // MoodModule, PlaceModule에서 사용
})
export class CreditModule {}

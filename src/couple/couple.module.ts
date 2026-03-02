import { Module } from '@nestjs/common';
import { CoupleController } from './couple.controller';
import { CoupleService } from './couple.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditModule } from '../credit/credit.module';
import { PlaceModule } from '../place/place.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, CreditModule, PlaceModule, NotificationModule],
  controllers: [CoupleController],
  providers: [CoupleService],
  exports: [CoupleService],
})
export class CoupleModule {}

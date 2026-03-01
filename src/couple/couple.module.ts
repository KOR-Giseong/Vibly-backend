import { Module } from '@nestjs/common';
import { CoupleController } from './couple.controller';
import { CoupleService } from './couple.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [PrismaModule, CreditModule],
  controllers: [CoupleController],
  providers: [CoupleService],
  exports: [CoupleService],
})
export class CoupleModule {}

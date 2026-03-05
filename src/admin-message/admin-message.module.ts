import { Module } from '@nestjs/common';
import { AdminMessageService } from './admin-message.service';
import { AdminMessageController } from './admin-message.controller';

@Module({
  controllers: [AdminMessageController],
  providers: [AdminMessageService],
})
export class AdminMessageModule {}

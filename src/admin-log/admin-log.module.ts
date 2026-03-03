import { Module } from '@nestjs/common';
import { AdminLogService } from './admin-log.service';
import { AdminLogController } from './admin-log.controller';
import { AdminLogInterceptor } from './admin-log.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  controllers: [AdminLogController],
  providers: [
    AdminLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AdminLogInterceptor,
    },
  ],
  exports: [AdminLogService],
})
export class AdminLogModule {}

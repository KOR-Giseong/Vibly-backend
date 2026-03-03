import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { AdminLogService } from './admin-log.service';

@ApiTags('AdminLog')
@Controller('admin-logs')
@UseGuards(AdminJwtGuard)
@ApiBearerAuth()
export class AdminLogController {
  constructor(private adminLogService: AdminLogService) {}

  @Get()
  getLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminLogService.getLogs(+(page ?? 1), +(limit ?? 50));
  }
}

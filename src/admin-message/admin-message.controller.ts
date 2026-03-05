import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AdminMessageService } from './admin-message.service';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';

@Controller('admin-messages')
@UseGuards(AdminJwtGuard)
export class AdminMessageController {
  constructor(private service: AdminMessageService) {}

  @Get()
  getMessages(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.service.getMessages(+page, +limit);
  }

  @Post()
  createMessage(@Req() req: any, @Body('content') content: string) {
    return this.service.createMessage(req.user.id, content);
  }

  @Delete(':id')
  deleteMessage(@Param('id') id: string, @Req() req: any) {
    return this.service.deleteMessage(id, req.user.id);
  }
}

import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ── 디바이스 토큰 등록 ─────────────────────────────────────────────────────
  @Post('register-token')
  registerToken(
    @Req() req: { user: { id: string } },
    @Body() dto: RegisterTokenDto,
  ) {
    return this.notificationService.registerToken(
      req.user.id,
      dto.pushToken,
      dto.platform,
    );
  }

  // ── 알림 목록 ──────────────────────────────────────────────────────────────
  @Get()
  getList(
    @Req() req: { user: { id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
  ) {
    return this.notificationService.getList(req.user.id, page, limit);
  }

  // ── 읽지 않은 수 ───────────────────────────────────────────────────────────
  @Get('unread-count')
  getUnreadCount(@Req() req: { user: { id: string } }) {
    return this.notificationService
      .getUnreadCount(req.user.id)
      .then((count) => ({ count }));
  }

  // ── 전체 읽음 처리 ─────────────────────────────────────────────────────────
  @Patch('read-all')
  markAllRead(@Req() req: { user: { id: string } }) {
    return this.notificationService.markAllRead(req.user.id);
  }

  // ── 단건 읽음 처리 ─────────────────────────────────────────────────────────
  @Patch(':id/read')
  markRead(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.notificationService.markRead(id, req.user.id);
  }

  // ── 단건 삭제 ──────────────────────────────────────────────────────────────
  @Delete(':id')
  deleteOne(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.notificationService.deleteOne(id, req.user.id);
  }
}

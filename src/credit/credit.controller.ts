import { Controller, Get, Post, Patch, Query, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreditService } from './credit.service';

@ApiTags('Credit')
@Controller('credits')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreditController {
  constructor(private creditService: CreditService) {}

  // 잔액 + 구독 여부 조회
  @Get('balance')
  getBalance(@Req() req: any) {
    return this.creditService.getBalance(req.user.id);
  }

  // 광고 시청 보상
  @Post('watch-ad')
  watchAd(@Req() req: any) {
    return this.creditService.watchAd(req.user.id);
  }

  // 오늘 광고 시청 횟수
  @Get('ad-watches-today')
  getAdWatchesToday(@Req() req: any) {
    return this.creditService.getAdWatchesToday(req.user.id).then((count) => ({
      adWatchesToday: count,
      maxAdWatches: 5,
    }));
  }

  // 크레딧 내역
  @Get('history')
  getHistory(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creditService.getHistory(req.user.id, +(page ?? 1), +(limit ?? 20));
  }

  // ── 어드민 ────────────────────────────────────────────────────────────────

  // 전체 유저 크레딧 목록
  @Get('admin/users')
  adminGetUsers(@Req() req: any) {
    return this.creditService.adminGetUsersWithCredits(req.user.id);
  }

  // 특정 유저 크레딧 지급/차감
  @Patch('admin/users/:id/adjust')
  adminAdjust(
    @Req() req: any,
    @Param('id') userId: string,
    @Body() body: { amount: number },
  ) {
    return this.creditService.adminAdjustCredits(req.user.id, userId, body.amount);
  }
}

import { Controller, Get, Post, Patch, Delete, Query, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreditService, SubscriptionType, SubscriptionPlatform } from './credit.service';
import { AppConfigService } from '../config/app-config.service';

@ApiTags('Credit')
@Controller('credits')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreditController {
  constructor(
    private creditService: CreditService,
    private appConfigService: AppConfigService,
  ) {}

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

  // 인앱결제 검증
  @Post('subscription/verify-purchase')
  verifyPurchase(
    @Req() req: any,
    @Body() body: { platform: SubscriptionPlatform; productId: string; receiptData: string },
  ) {
    return this.creditService.verifyPurchase(
      req.user.id,
      body.platform,
      body.productId,
      body.receiptData,
    );
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

  // 구독자 목록 (활성)
  @Get('admin/subscriptions')
  adminListSubscriptions(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creditService.adminListSubscriptions(req.user.id, +(page ?? 1), +(limit ?? 30));
  }

  // 구독 부여
  @Post('admin/subscriptions')
  adminGrantSubscription(
    @Req() req: any,
    @Body() body: { userId: string; type: SubscriptionType; durationDays: number },
  ) {
    return this.creditService.adminGrantSubscription(
      req.user.id,
      body.userId,
      body.type,
      body.durationDays,
    );
  }

  // 구독 취소
  @Delete('admin/subscriptions/:userId')
  adminRevokeSubscription(@Req() req: any, @Param('userId') userId: string) {
    return this.creditService.adminRevokeSubscription(req.user.id, userId);
  }

  // 앱 설정 전체 조회
  @Get('admin/app-config')
  adminGetAppConfig(@Req() req: any) {
    if (!req.user?.isAdmin) throw new ForbiddenException('관리자만 접근할 수 있어요.');
    return this.appConfigService.getAll();
  }

  // 앱 설정 변경
  @Patch('admin/app-config')
  adminSetAppConfig(
    @Req() req: any,
    @Body() body: { key: string; value: string },
  ) {
    if (!req.user?.isAdmin) throw new ForbiddenException('관리자만 접근할 수 있어요.');
    return this.appConfigService.set(body.key, body.value).then(() => ({ ok: true }));
  }
}

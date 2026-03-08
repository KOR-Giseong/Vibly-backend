import { Controller, Get, Post, Patch, Delete, Query, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { CreditService, SubscriptionType, SubscriptionPlatform } from './credit.service';
import { AppConfigService } from '../config/app-config.service';

@ApiTags('Credit')
@Controller('credits')
@ApiBearerAuth()
export class CreditController {
  constructor(
    private creditService: CreditService,
    private appConfigService: AppConfigService,
  ) {}

  // ── 공개 ────────────────────────────────────────────────────────────────

  @Get('app-config')
  getPublicAppConfig() {
    return this.appConfigService.getPublic();
  }

  // ── 사용자 ────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('balance')
  getBalance(@Req() req: any) {
    return this.creditService.getBalance(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('watch-ad')
  watchAd(@Req() req: any) {
    return this.creditService.watchAd(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('ad-watches-today')
  getAdWatchesToday(@Req() req: any) {
    return this.creditService.getAdWatchesToday(req.user.id).then((count) => ({
      adWatchesToday: count,
      maxAdWatches: 5,
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('attendance/status')
  getAttendanceStatus(@Req() req: any) {
    return this.creditService.getAttendanceStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('attendance/check')
  checkDailyAttendance(@Req() req: any) {
    return this.creditService.checkDailyAttendance(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  getHistory(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creditService.getHistory(req.user.id, +(page ?? 1), +(limit ?? 20));
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Post('subscription/trial')
  startFreeTrial(@Req() req: any) {
    return this.creditService.startFreeTrial(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscription')
  cancelSubscription(@Req() req: any) {
    return this.creditService.cancelSubscription(req.user.id);
  }

  // ── 어드민 ────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @Get('admin/users')
  adminGetUsers(@Req() req: any) {
    return this.creditService.adminGetUsersWithCredits(req.user.id);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/users/:id/adjust')
  adminAdjust(
    @Req() req: any,
    @Param('id') userId: string,
    @Body() body: { amount: number },
  ) {
    return this.creditService.adminAdjustCredits(req.user.id, userId, body.amount);
  }

  @UseGuards(AdminJwtGuard)
  @Get('admin/subscriptions')
  adminListSubscriptions(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creditService.adminListSubscriptions(req.user.id, +(page ?? 1), +(limit ?? 30));
  }

  @UseGuards(AdminJwtGuard)
  @Get('admin/subscriptions/history')
  adminGetSubscriptionHistory(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creditService.adminGetAllSubscriptions(req.user.id, +(page ?? 1), +(limit ?? 30));
  }

  @UseGuards(AdminJwtGuard)
  @Get('admin/credit-history')
  adminGetCreditHistory(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creditService.adminGetCreditGrantHistory(req.user.id, +(page ?? 1), +(limit ?? 30));
  }

  @UseGuards(AdminJwtGuard)
  @Post('admin/bulk-grant')
  adminBulkGrant(
    @Req() req: any,
    @Body() body: { amount: number; note?: string },
  ) {
    return this.creditService.adminBulkGrantCredits(req.user.id, body.amount, body.note);
  }

  @UseGuards(AdminJwtGuard)
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

  @UseGuards(AdminJwtGuard)
  @Delete('admin/subscriptions/:userId')
  adminRevokeSubscription(@Req() req: any, @Param('userId') userId: string) {
    return this.creditService.adminRevokeSubscription(req.user.id, userId);
  }

  @UseGuards(AdminJwtGuard)
  @Get('admin/app-config')
  adminGetAppConfig() {
    return this.appConfigService.getAll();
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/app-config')
  adminSetAppConfig(@Body() body: { key: string; value: string }) {
    return this.appConfigService.set(body.key, body.value).then(() => ({ ok: true }));
  }
}

import {
  Controller, Get, Post, Patch, Delete,
  Req, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { CoupleService } from './couple.service';

@ApiTags('Couple')
@Controller('couple')
@ApiBearerAuth()
export class CoupleController {
  constructor(private coupleService: CoupleService) {}

  // ── 사용자 ──────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return this.coupleService.getMyCoupleInfo(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  searchUser(@Req() req: any, @Query('q') q: string) {
    return this.coupleService.searchUserForInvite(q ?? '', req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invite')
  sendInvitation(
    @Req() req: any,
    @Body() body: { receiverId: string; message?: string },
  ) {
    return this.coupleService.sendInvitation(req.user.id, body.receiverId, body.message);
  }

  @UseGuards(JwtAuthGuard)
  @Get('invitations/received')
  getReceivedInvitations(@Req() req: any) {
    return this.coupleService.getReceivedInvitations(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('invitations/sent')
  getSentInvitations(@Req() req: any) {
    return this.coupleService.getSentInvitations(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations/:id/respond')
  respondToInvitation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { accept: boolean },
  ) {
    return this.coupleService.respondToInvitation(id, req.user.id, body.accept);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('invitations/:id')
  cancelInvitation(@Req() req: any, @Param('id') id: string) {
    return this.coupleService.cancelInvitation(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('dissolve')
  dissolveCouple(@Req() req: any) {
    return this.coupleService.dissolveCouple(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('credit-share')
  toggleCreditShare(@Req() req: any, @Body() body: { enabled: boolean }) {
    return this.coupleService.toggleCreditShare(req.user.id, body.enabled);
  }

  @UseGuards(JwtAuthGuard)
  @Post('transfer-credits')
  transferCredits(@Req() req: any, @Body() body: { amount: number }) {
    return this.coupleService.transferCreditsToPartner(req.user.id, body.amount);
  }

  @UseGuards(JwtAuthGuard)
  @Get('credit-history')
  getCreditHistory(@Req() req: any) {
    return this.coupleService.getCreditHistory(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('partner/bookmarks')
  getPartnerBookmarks(@Req() req: any) {
    return this.coupleService.getPartnerBookmarks(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('partner/profile')
  getPartnerProfile(@Req() req: any) {
    return this.coupleService.getPartnerProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('anniversary')
  setAnniversary(@Req() req: any, @Body() body: { anniversaryDate: string }) {
    return this.coupleService.setAnniversaryDate(req.user.id, new Date(body.anniversaryDate));
  }

  @UseGuards(JwtAuthGuard)
  @Get('date-plans')
  getDatePlans(@Req() req: any) {
    return this.coupleService.getDatePlans(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('date-plans')
  createDatePlan(
    @Req() req: any,
    @Body() body: { title: string; dateAt: string; memo?: string; placeIds?: string[] },
  ) {
    return this.coupleService.createDatePlan(req.user.id, {
      title: body.title,
      dateAt: new Date(body.dateAt),
      memo: body.memo,
      placeIds: body.placeIds,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('date-plans/:id')
  updateDatePlan(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { title?: string; dateAt?: string; memo?: string; status?: 'PLANNED' | 'COMPLETED' | 'CANCELLED'; placeIds?: string[] },
  ) {
    return this.coupleService.updateDatePlan(req.user.id, id, {
      ...body,
      dateAt: body.dateAt ? new Date(body.dateAt) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('date-plans/:id')
  deleteDatePlan(@Req() req: any, @Param('id') id: string) {
    return this.coupleService.deleteDatePlan(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('date-plans/ai-analysis')
  aiDateAnalysis(@Req() req: any, @Body() body: { userNote?: string }) {
    return this.coupleService.aiDateAnalysis(req.user.id, body?.userNote);
  }

  @UseGuards(JwtAuthGuard)
  @Post('date-plans/ai-refine')
  aiRefineTimeline(@Req() req: any, @Body() body: { timeline: any[]; feedback: string }) {
    return this.coupleService.aiRefineTimeline(req.user.id, body.timeline, body.feedback);
  }

  @UseGuards(JwtAuthGuard)
  @Post('date-plans/ai-chat')
  aiDateChat(
    @Req() req: any,
    @Body() body: {
      messages: Array<{ role: 'user' | 'model'; text: string }>;
      lat?: number;
      lng?: number;
      imageBase64?: string;
      imageMimeType?: string;
    },
  ) {
    return this.coupleService.aiDateChat(req.user.id, body.messages, body.lat, body.lng, body.imageBase64, body.imageMimeType);
  }

  @UseGuards(JwtAuthGuard)
  @Get('memories')
  getMemories(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coupleService.getMemories(req.user.id, +(page ?? 1), +(limit ?? 20));
  }

  @UseGuards(JwtAuthGuard)
  @Post('memories')
  uploadMemory(
    @Req() req: any,
    @Body() body: { imageBase64: string; caption?: string; takenAt?: string },
  ) {
    return this.coupleService.uploadMemory(req.user.id, {
      base64: body.imageBase64,
      caption: body.caption,
      takenAt: body.takenAt ? new Date(body.takenAt) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('memories/:id')
  deleteMemory(@Req() req: any, @Param('id') id: string) {
    return this.coupleService.deleteMemory(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('report')
  reportUser(
    @Req() req: any,
    @Body() body: { reportedId: string; reason: string; detail?: string; imageUrls?: string[] },
  ) {
    return this.coupleService.reportUser(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages')
  getMessages(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coupleService.getMessages(req.user.id, +(page ?? 1), +(limit ?? 50));
  }

  @UseGuards(JwtAuthGuard)
  @Post('messages')
  sendMessage(
    @Req() req: any,
    @Body() body: { type: 'TEXT' | 'IMAGE' | 'EMOJI'; text?: string; imageBase64?: string; emoji?: string },
  ) {
    return this.coupleService.sendMessage(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('messages/read')
  markMessagesRead(@Req() req: any) {
    return this.coupleService.markMessagesRead(req.user.id);
  }

  // ── 어드민 ──────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @Get('admin/user-reports')
  adminGetUserReports(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unresolved') unresolved?: string,
  ) {
    return this.coupleService.adminGetUserReports(
      req.user.id,
      +(page ?? 1),
      +(limit ?? 30),
      unresolved === 'true',
    );
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/user-reports/:id/resolve')
  adminResolveUserReport(@Req() req: any, @Param('id') id: string) {
    return this.coupleService.adminResolveUserReport(req.user.id, id);
  }

  @UseGuards(AdminJwtGuard)
  @Get('admin/list')
  adminGetCouples(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.coupleService.adminGetCouples(req.user.id, +(page ?? 1), +(limit ?? 30), status);
  }

  @UseGuards(AdminJwtGuard)
  @Delete('admin/:id')
  adminDissolveCouple(@Req() req: any, @Param('id') id: string) {
    return this.coupleService.adminDissolveCouple(req.user.id, id);
  }
}

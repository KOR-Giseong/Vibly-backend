import {
  Controller, Get, Post, Patch, Delete,
  Req, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CoupleService } from './couple.service';

@ApiTags('Couple')
@Controller('couple')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CoupleController {
  constructor(private coupleService: CoupleService) {}

  // ── 내 커플 정보 ─────────────────────────────────────────────────────────────
  @Get('me')
  getMe(@Req() req: any) {
    return this.coupleService.getMyCoupleInfo(req.user.id);
  }

  // ── 유저 검색 ────────────────────────────────────────────────────────────────
  @Get('search')
  searchUser(@Req() req: any, @Query('q') q: string) {
    return this.coupleService.searchUserForInvite(q ?? '', req.user.id);
  }

  // ── 초대 전송 ────────────────────────────────────────────────────────────────
  @Post('invite')
  sendInvitation(
    @Req() req: any,
    @Body() body: { receiverId: string; message?: string },
  ) {
    return this.coupleService.sendInvitation(req.user.id, body.receiverId, body.message);
  }

  // ── 받은 초대 목록 ───────────────────────────────────────────────────────────
  @Get('invitations/received')
  getReceivedInvitations(@Req() req: any) {
    return this.coupleService.getReceivedInvitations(req.user.id);
  }

  // ── 보낸 초대 목록 ───────────────────────────────────────────────────────────
  @Get('invitations/sent')
  getSentInvitations(@Req() req: any) {
    return this.coupleService.getSentInvitations(req.user.id);
  }

  // ── 초대 수락/거절 ───────────────────────────────────────────────────────────
  @Post('invitations/:id/respond')
  respondToInvitation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { accept: boolean },
  ) {
    return this.coupleService.respondToInvitation(id, req.user.id, body.accept);
  }

  // ── 보낸 초대 취소 ───────────────────────────────────────────────────────────
  @Delete('invitations/:id')
  cancelInvitation(@Req() req: any, @Param('id') id: string) {
    return this.coupleService.cancelInvitation(id, req.user.id);
  }

  // ── 커플 해제 ────────────────────────────────────────────────────────────────
  @Delete('dissolve')
  dissolveCouple(@Req() req: any) {
    return this.coupleService.dissolveCouple(req.user.id);
  }

  // ── 크레딧 공유 토글 ─────────────────────────────────────────────────────────
  @Patch('credit-share')
  toggleCreditShare(@Req() req: any, @Body() body: { enabled: boolean }) {
    return this.coupleService.toggleCreditShare(req.user.id, body.enabled);
  }

  // ── 크레딧 전송 ──────────────────────────────────────────────────────────────
  @Post('transfer-credits')
  transferCredits(@Req() req: any, @Body() body: { amount: number }) {
    return this.coupleService.transferCreditsToPartner(req.user.id, body.amount);
  }

  // ── 크레딧 선물 내역 ─────────────────────────────────────────────────────────
  @Get('credit-history')
  getCreditHistory(@Req() req: any) {
    return this.coupleService.getCreditHistory(req.user.id);
  }

  // ── 파트너 스크랩 ────────────────────────────────────────────────────────────
  @Get('partner/bookmarks')
  getPartnerBookmarks(@Req() req: any) {
    return this.coupleService.getPartnerBookmarks(req.user.id);
  }

  // ── 파트너 프로필 ────────────────────────────────────────────────────────────
  @Get('partner/profile')
  getPartnerProfile(@Req() req: any) {
    return this.coupleService.getPartnerProfile(req.user.id);
  }

  // ── 기념일 설정 ──────────────────────────────────────────────────────────────
  @Patch('anniversary')
  setAnniversary(@Req() req: any, @Body() body: { anniversaryDate: string }) {
    return this.coupleService.setAnniversaryDate(req.user.id, new Date(body.anniversaryDate));
  }

  // ── 데이트 플랜 ──────────────────────────────────────────────────────────────
  @Get('date-plans')
  getDatePlans(@Req() req: any) {
    return this.coupleService.getDatePlans(req.user.id);
  }

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

  @Delete('date-plans/:id')
  deleteDatePlan(@Req() req: any, @Param('id') id: string) {
    return this.coupleService.deleteDatePlan(req.user.id, id);
  }

  // ── AI 데이트 분석 ───────────────────────────────────────────────────────────
  @Post('date-plans/ai-analysis')
  aiDateAnalysis(@Req() req: any, @Body() body: { userNote?: string }) {
    return this.coupleService.aiDateAnalysis(req.user.id, body?.userNote);
  }

  @Post('date-plans/ai-refine')
  aiRefineTimeline(@Req() req: any, @Body() body: { timeline: any[]; feedback: string }) {
    return this.coupleService.aiRefineTimeline(req.user.id, body.timeline, body.feedback);
  }

  // ── 추억 사진 ────────────────────────────────────────────────────────────────
  @Get('memories')
  getMemories(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coupleService.getMemories(req.user.id, +(page ?? 1), +(limit ?? 20));
  }

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

  @Delete('memories/:id')
  deleteMemory(@Req() req: any, @Param('id') id: string) {
    return this.coupleService.deleteMemory(req.user.id, id);
  }

  // ── 유저 신고 ─────────────────────────────────────────────────────────────────
  @Post('report')
  reportUser(
    @Req() req: any,
    @Body() body: { reportedId: string; reason: string; detail?: string },
  ) {
    return this.coupleService.reportUser(req.user.id, body);
  }

  // ── 어드민: 유저 신고 ─────────────────────────────────────────────────────────
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

  @Patch('admin/user-reports/:id/resolve')
  adminResolveUserReport(@Req() req: any, @Param('id') id: string) {
    return this.coupleService.adminResolveUserReport(req.user.id, id);
  }

  // ── 어드민 ────────────────────────────────────────────────────────────────────
  @Get('admin/list')
  adminGetCouples(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.coupleService.adminGetCouples(req.user.id, +(page ?? 1), +(limit ?? 30), status);
  }

  @Delete('admin/:id')
  adminDissolveCouple(@Req() req: any, @Param('id') id: string) {
    return this.coupleService.adminDissolveCouple(req.user.id, id);
  }

  // ── 채팅 ──────────────────────────────────────────────────────────────────────
  @Get('messages')
  getMessages(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coupleService.getMessages(req.user.id, +(page ?? 1), +(limit ?? 50));
  }

  @Post('messages')
  sendMessage(
    @Req() req: any,
    @Body() body: { type: 'TEXT' | 'IMAGE' | 'EMOJI'; text?: string; imageBase64?: string; emoji?: string },
  ) {
    return this.coupleService.sendMessage(req.user.id, body);
  }

  @Patch('messages/read')
  markMessagesRead(@Req() req: any) {
    return this.coupleService.markMessagesRead(req.user.id);
  }

  // AI 대화형 데이트 비서 (프리미엄 + 커플 전용)
  @Post('date-plans/ai-chat')
  aiDateChat(
    @Req() req: any,
    @Body() body: {
      messages: Array<{ role: 'user' | 'model'; text: string }>;
      lat?: number;
      lng?: number;
    },
  ) {
    return this.coupleService.aiDateChat(req.user.id, body.messages, body.lat, body.lng);
  }
}

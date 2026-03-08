import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { Request } from 'express';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { R2Service } from '../storage/r2.service';

interface AuthRequest extends Request {
  user: { id: string; isAdmin: boolean };
}

@ApiTags('Support')
@Controller('support')
@ApiBearerAuth()
export class SupportController {
  constructor(
    private supportService: SupportService,
    private r2: R2Service,
  ) {}

  // ── 사용자 ────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('faq-categories')
  getFaqCategories() {
    return this.supportService.getFaqCategories();
  }

  @UseGuards(JwtAuthGuard)
  @Post('tickets')
  createTicket(
    @Req() req: AuthRequest,
    @Body() body: { title: string; body: string; type?: 'FAQ' | 'CHAT' },
  ) {
    return this.supportService.createTicket(
      req.user.id,
      body.title,
      body.body,
      body.type,
    );
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get('tickets/mine')
  getMyTickets(@Req() req: AuthRequest) {
    return this.supportService.getMyTickets(req.user.id);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get('tickets/:id/messages')
  getMessages(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.getMessages(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/'))
          return cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
        cb(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const ext = extname(file.originalname).replace('.', '') || 'jpg';
    const imageUrl = await this.r2.upload(file.buffer, 'support-images', ext, file.mimetype);
    return { imageUrl };
  }

  @UseGuards(JwtAuthGuard)
  @Post('tickets/:id/messages')
  sendMessage(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { body: string; imageUrl?: string },
  ) {
    return this.supportService.sendMessage(
      req.user.id,
      id,
      body.body,
      body.imageUrl,
    );
  }

  // ── 관리자 ────────────────────────────────────────────────────────────────

  @SkipThrottle()
  @UseGuards(AdminJwtGuard)
  @Get('admin/tickets')
  getAllTickets(@Req() req: AuthRequest) {
    return this.supportService.getAllTickets(req.user.id);
  }

  @SkipThrottle()
  @UseGuards(AdminJwtGuard)
  @Get('admin/tickets/:id/messages')
  getTicketMessages(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.getTicketMessages(req.user.id, id);
  }

  @UseGuards(AdminJwtGuard)
  @Post('admin/tickets/:id/messages')
  adminSendMessage(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { body: string; imageUrl?: string },
  ) {
    return this.supportService.adminSendMessage(
      req.user.id,
      id,
      body.body,
      body.imageUrl,
    );
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/tickets/:id/reply')
  replyTicket(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { reply: string },
  ) {
    return this.supportService.replyTicket(req.user.id, id, body.reply);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/tickets/:id/status')
  updateTicketStatus(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.supportService.updateTicketStatus(req.user.id, id, body.status);
  }

  @UseGuards(AdminJwtGuard)
  @Get('admin/users')
  getUsers(@Req() req: AuthRequest) {
    return this.supportService.getUsers(req.user.id);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/users/:id/suspend')
  suspendUser(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { reason: string; suspendedUntil: string },
  ) {
    return this.supportService.suspendUser(
      req.user.id,
      id,
      body.reason,
      new Date(body.suspendedUntil),
    );
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/users/:id/unsuspend')
  unsuspendUser(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.unsuspendUser(req.user.id, id);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/users/:id/toggle-admin')
  toggleAdmin(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.toggleAdmin(req.user.id, id);
  }

  @SkipThrottle()
  @UseGuards(AdminJwtGuard)
  @Get('admin/stats')
  getAdminStats(@Req() req: AuthRequest) {
    return this.supportService.getAdminStats(req.user.id);
  }

  @SkipThrottle()
  @UseGuards(AdminJwtGuard)
  @Get('admin/places')
  getAdminPlaces(@Req() req: AuthRequest) {
    return this.supportService.getAdminPlaces(req.user.id);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/places/:id/toggle-active')
  togglePlaceActive(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.togglePlaceActive(req.user.id, id);
  }

  @SkipThrottle()
  @UseGuards(AdminJwtGuard)
  @Get('admin/checkins')
  getAdminCheckIns(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.getAdminCheckIns(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 30,
    );
  }

  @UseGuards(AdminJwtGuard)
  @Delete('admin/checkins/:id')
  deleteAdminCheckIn(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.deleteAdminCheckIn(req.user.id, id);
  }

  @SkipThrottle()
  @UseGuards(AdminJwtGuard)
  @Get('admin/reviews')
  getAdminReviews(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.getAdminReviews(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 30,
    );
  }

  @UseGuards(AdminJwtGuard)
  @Delete('admin/reviews/:id')
  deleteAdminReview(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.deleteAdminReview(req.user.id, id);
  }

  // ── 탈퇴 계정 (재가입 제한 해제) ──────────────────────────────────────────
  @UseGuards(AdminJwtGuard)
  @Get('admin/deleted-accounts')
  getDeletedAccounts(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.getDeletedAccounts(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 30,
    );
  }

  @UseGuards(AdminJwtGuard)
  @Delete('admin/deleted-accounts/:id')
  unlockDeletedAccount(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.unlockDeletedAccount(req.user.id, id);
  }
}

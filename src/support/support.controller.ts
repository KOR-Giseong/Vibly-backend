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
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthRequest extends Request {
  user: { id: string; isAdmin: boolean };
}

@ApiTags('Support')
@Controller('support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private supportService: SupportService) {}

  // ── 사용자 ────────────────────────────────────────────────────────────────

  @Get('faq-categories')
  getFaqCategories() {
    return this.supportService.getFaqCategories();
  }

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
  @Get('tickets/mine')
  getMyTickets(@Req() req: AuthRequest) {
    return this.supportService.getMyTickets(req.user.id);
  }

  @SkipThrottle()
  @Get('tickets/:id/messages')
  getMessages(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.getMessages(req.user.id, id);
  }

  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './public/support-images',
        filename: (_req, file, cb) =>
          cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/'))
          return cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
        cb(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return { imageUrl: `/public/support-images/${file.filename}` };
  }

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
  @Get('admin/tickets')
  getAllTickets(@Req() req: AuthRequest) {
    return this.supportService.getAllTickets(req.user.id);
  }

  @SkipThrottle()
  @Get('admin/tickets/:id/messages')
  getTicketMessages(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.getTicketMessages(req.user.id, id);
  }

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

  @Patch('admin/tickets/:id/reply')
  replyTicket(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { reply: string },
  ) {
    return this.supportService.replyTicket(req.user.id, id, body.reply);
  }

  @Patch('admin/tickets/:id/status')
  updateTicketStatus(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.supportService.updateTicketStatus(req.user.id, id, body.status);
  }

  @Get('admin/users')
  getUsers(@Req() req: AuthRequest) {
    return this.supportService.getUsers(req.user.id);
  }

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

  @Patch('admin/users/:id/unsuspend')
  unsuspendUser(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.unsuspendUser(req.user.id, id);
  }

  @Patch('admin/users/:id/toggle-admin')
  toggleAdmin(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.toggleAdmin(req.user.id, id);
  }

  @SkipThrottle()
  @Get('admin/stats')
  getAdminStats(@Req() req: AuthRequest) {
    return this.supportService.getAdminStats(req.user.id);
  }

  @SkipThrottle()
  @Get('admin/places')
  getAdminPlaces(@Req() req: AuthRequest) {
    return this.supportService.getAdminPlaces(req.user.id);
  }

  @Patch('admin/places/:id/toggle-active')
  togglePlaceActive(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.togglePlaceActive(req.user.id, id);
  }

  // ── 체크인 관리 ────────────────────────────────────────────────────────────

  @SkipThrottle()
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

  @Delete('admin/checkins/:id')
  deleteAdminCheckIn(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.deleteAdminCheckIn(req.user.id, id);
  }

  // ── 리뷰 관리 ──────────────────────────────────────────────────────────────

  @SkipThrottle()
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

  @Delete('admin/reviews/:id')
  deleteAdminReview(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.supportService.deleteAdminReview(req.user.id, id);
  }
}

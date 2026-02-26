import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, Req,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
    @Req() req: any,
    @Body() body: { title: string; body: string; type?: 'FAQ' | 'CHAT' },
  ) {
    return this.supportService.createTicket(req.user.id, body.title, body.body, body.type);
  }

  @SkipThrottle()
  @Get('tickets/mine')
  getMyTickets(@Req() req: any) {
    return this.supportService.getMyTickets(req.user.id);
  }

  @SkipThrottle()
  @Get('tickets/:id/messages')
  getMessages(@Req() req: any, @Param('id') id: string) {
    return this.supportService.getMessages(req.user.id, id);
  }

  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './public/support-images',
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
        cb(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return { imageUrl: `/public/support-images/${file.filename}` };
  }

  @Post('tickets/:id/messages')
  sendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { body: string; imageUrl?: string },
  ) {
    return this.supportService.sendMessage(req.user.id, id, body.body, body.imageUrl);
  }

  // ── 관리자 ────────────────────────────────────────────────────────────────

  @SkipThrottle()
  @Get('admin/tickets')
  getAllTickets(@Req() req: any) {
    return this.supportService.getAllTickets(req.user.id);
  }

  @SkipThrottle()
  @Get('admin/tickets/:id/messages')
  getTicketMessages(@Req() req: any, @Param('id') id: string) {
    return this.supportService.getTicketMessages(req.user.id, id);
  }

  @Post('admin/tickets/:id/messages')
  adminSendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { body: string; imageUrl?: string },
  ) {
    return this.supportService.adminSendMessage(req.user.id, id, body.body, body.imageUrl);
  }

  @Patch('admin/tickets/:id/reply')
  replyTicket(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reply: string },
  ) {
    return this.supportService.replyTicket(req.user.id, id, body.reply);
  }

  @Patch('admin/tickets/:id/status')
  updateTicketStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.supportService.updateTicketStatus(req.user.id, id, body.status);
  }

  @Get('admin/users')
  getUsers(@Req() req: any) {
    return this.supportService.getUsers(req.user.id);
  }

  @Patch('admin/users/:id/suspend')
  suspendUser(
    @Req() req: any,
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
  unsuspendUser(@Req() req: any, @Param('id') id: string) {
    return this.supportService.unsuspendUser(req.user.id, id);
  }

  @Patch('admin/users/:id/toggle-admin')
  toggleAdmin(@Req() req: any, @Param('id') id: string) {
    return this.supportService.toggleAdmin(req.user.id, id);
  }
}

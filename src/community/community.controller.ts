import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PostCategory } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CommunityService } from './community.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateReportDto } from './dto/create-report.dto';

interface AuthRequest extends Request {
  user: { id: string; isAdmin: boolean };
}

interface OptionalAuthRequest extends Request {
  user?: { id: string; isAdmin: boolean };
}

@ApiTags('Community')
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // ─── 공지사항 (비인증 조회 허용) ──────────────────────────────────────────

  @SkipThrottle()
  @Get('notices')
  getNotices(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.communityService.getNotices(
      Number(page ?? 1),
      Number(limit ?? 20),
    );
  }

  @SkipThrottle()
  @Get('notices/:id')
  getNoticeById(@Param('id') id: string) {
    return this.communityService.getNoticeById(id);
  }

  // ─── 공지사항 관리자 전용 ─────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Post('notices')
  createNotice(@Body() dto: CreateNoticeDto) {
    return this.communityService.createNotice(dto);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Patch('notices/:id')
  updateNotice(
    @Param('id') id: string,
    @Body() dto: Partial<CreateNoticeDto>,
  ) {
    return this.communityService.updateNotice(id, dto);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Delete('notices/:id')
  deleteNotice(@Param('id') id: string) {
    return this.communityService.deleteNotice(id);
  }

  // ─── 게시글 (비인증 목록/상세 허용) ──────────────────────────────────────

  @SkipThrottle()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('posts')
  getPosts(
    @Query('category') category?: PostCategory,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: OptionalAuthRequest,
  ) {
    const userId = req?.user?.id;
    return this.communityService.getPosts(
      category,
      Number(page ?? 1),
      Number(limit ?? 20),
      userId,
    );
  }

  @SkipThrottle()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('posts/:id')
  getPostById(@Param('id') id: string, @Req() req: OptionalAuthRequest) {
    const userId = req.user?.id;
    return this.communityService.getPostById(id, userId);
  }

  // ─── 게시글 (인증 필요) ───────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('posts')
  createPost(@Req() req: AuthRequest, @Body() dto: CreatePostDto) {
    return this.communityService.createPost(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('posts/:id')
  updatePost(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePostDto>,
  ) {
    return this.communityService.updatePost(id, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('posts/:id')
  deletePost(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.communityService.deletePost(id, req.user.id, req.user.isAdmin);
  }

  // ─── 좋아요 ───────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('posts/:id/like')
  toggleLike(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.communityService.toggleLike(id, req.user.id);
  }

  // ─── 댓글 ─────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('posts/:id/comments')
  addComment(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.communityService.addComment(id, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('comments/:id')
  deleteComment(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.communityService.deleteComment(
      id,
      req.user.id,
      req.user.isAdmin,
    );
  }

  // ─── 신고 ───────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('posts/:id/report')
  reportPost(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.communityService.reportPost(id, req.user.id, dto);
  }

  // ─── 관리자 ───────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @SkipThrottle()
  @Get('admin/posts')
  adminGetPosts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communityService.adminGetPosts(
      Number(page ?? 1),
      Number(limit ?? 30),
    );
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Patch('admin/posts/:id/hidden')
  adminToggleHidden(@Param('id') id: string) {
    return this.communityService.adminToggleHidden(id);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Patch('admin/posts/:id/pinned')
  adminTogglePinned(@Param('id') id: string) {
    return this.communityService.adminTogglePinned(id);
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @SkipThrottle()
  @Get('admin/reports')
  adminGetReports(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unresolved') unresolved?: string,
  ) {
    return this.communityService.adminGetReports(
      Number(page ?? 1),
      Number(limit ?? 30),
      unresolved === 'true',
    );
  }

  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @Patch('admin/reports/:id/resolve')
  adminResolveReport(
    @Param('id') id: string,
    @Body('hidePost') hidePost?: boolean,
  ) {
    return this.communityService.adminResolveReport(id, hidePost ?? false);
  }
}

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { PostCategory } from '@prisma/client';

const POST_SELECT = {
  id: true,
  category: true,
  title: true,
  body: true,
  imageUrl: true,
  isPinned: true,
  isHidden: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, nickname: true, name: true, avatarUrl: true } },
  _count: { select: { comments: true, likes: true } },
};

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 게시글 ───────────────────────────────────────────────────────────────

  async getPosts(
    category?: PostCategory,
    page = 1,
    limit = 20,
    userId?: string,
  ) {
    const where = {
      isHidden: false,
      ...(category ? { category } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        select: {
          ...POST_SELECT,
          likes: userId ? { where: { userId }, select: { id: true } } : false,
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: items.map((p) => this.formatPost(p, userId)),
      total,
      page,
      hasNext: page * limit < total,
    };
  }

  async getPostById(id: string, userId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: {
        ...POST_SELECT,
        body: true,
        likes: userId ? { where: { userId }, select: { id: true } } : false,
        comments: {
          where: { isHidden: false },
          select: {
            id: true,
            body: true,
            createdAt: true,
            user: {
              select: { id: true, nickname: true, name: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!post || post.isHidden)
      throw new NotFoundException('게시글을 찾을 수 없습니다.');

    // 조회수 증가 (fire-and-forget)
    this.prisma.post
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    return this.formatPost(post, userId);
  }

  async createPost(userId: string, dto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: { userId, ...dto },
      select: POST_SELECT,
    });
    return this.formatPost(post, userId);
  }

  async updatePost(id: string, userId: string, dto: Partial<CreatePostDto>) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    if (post.userId !== userId)
      throw new ForbiddenException('본인 게시글만 수정할 수 있습니다.');

    const updated = await this.prisma.post.update({
      where: { id },
      data: dto,
      select: POST_SELECT,
    });
    return this.formatPost(updated, userId);
  }

  async deletePost(id: string, userId: string, isAdmin: boolean) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    if (!isAdmin && post.userId !== userId)
      throw new ForbiddenException('권한이 없습니다.');
    await this.prisma.post.delete({ where: { id } });
  }

  // ─── 좋아요 ───────────────────────────────────────────────────────────────

  async toggleLike(postId: string, userId: string) {
    const existing = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await this.prisma.postLike.delete({ where: { id: existing.id } });
      return { liked: false };
    } else {
      await this.prisma.postLike.create({ data: { postId, userId } });
      return { liked: true };
    }
  }

  // ─── 댓글 ─────────────────────────────────────────────────────────────────

  async addComment(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.isHidden)
      throw new NotFoundException('게시글을 찾을 수 없습니다.');

    return this.prisma.postComment.create({
      data: { postId, userId, body: dto.body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: {
          select: { id: true, nickname: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  async deleteComment(commentId: string, userId: string, isAdmin: boolean) {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    if (!isAdmin && comment.userId !== userId)
      throw new ForbiddenException('권한이 없습니다.');
    await this.prisma.postComment.delete({ where: { id: commentId } });
  }

  // ─── 공지사항 ─────────────────────────────────────────────────────────────

  async getNotices(page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.notice.findMany({
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notice.count(),
    ]);
    return { items, total, page, hasNext: page * limit < total };
  }

  async getNoticeById(id: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    return notice;
  }

  createNotice(dto: CreateNoticeDto) {
    return this.prisma.notice.create({ data: dto });
  }

  async updateNotice(id: string, dto: Partial<CreateNoticeDto>) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    return this.prisma.notice.update({ where: { id }, data: dto });
  }

  async deleteNotice(id: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    await this.prisma.notice.delete({ where: { id } });
  }

  // ─── 관리자 ───────────────────────────────────────────────────────────────

  async adminGetPosts(page = 1, limit = 30) {
    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        select: {
          id: true,
          category: true,
          title: true,
          isHidden: true,
          isPinned: true,
          viewCount: true,
          createdAt: true,
          user: { select: { id: true, nickname: true, name: true } },
          _count: { select: { comments: true, likes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.post.count(),
    ]);
    return { items, total, page, hasNext: page * limit < total };
  }

  async adminToggleHidden(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    return this.prisma.post.update({
      where: { id },
      data: { isHidden: !post.isHidden },
    });
  }

  async adminTogglePinned(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    return this.prisma.post.update({
      where: { id },
      data: { isPinned: !post.isPinned },
    });
  }

  // ─── 신고 ───────────────────────────────────────────────────────────────

  async reportPost(postId: string, userId: string, dto: CreateReportDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    if (post.userId === userId)
      throw new ForbiddenException('자신의 게시글을 신고할 수 없습니다.');

    try {
      await this.prisma.postReport.create({
        data: { postId, userId, reason: dto.reason, detail: dto.detail },
      });
      return {
        success: true,
        message: '신고가 접수됐어요. 관리자가 검토 후 조치할게요.',
      };
    } catch {
      // 이미 신고한 경우
      throw new ForbiddenException('이미 신고한 게시글이에요.');
    }
  }

  async adminGetReports(page = 1, limit = 30, onlyUnresolved = false) {
    const where = onlyUnresolved ? { isResolved: false } : {};
    const [items, total] = await Promise.all([
      this.prisma.postReport.findMany({
        where,
        include: {
          post: {
            select: { id: true, title: true, category: true, isHidden: true },
          },
          user: { select: { id: true, nickname: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.postReport.count({ where }),
    ]);
    return { items, total, page, hasNext: page * limit < total };
  }

  async adminResolveReport(reportId: string, hidePost: boolean) {
    const report = await this.prisma.postReport.findUnique({
      where: { id: reportId },
      include: { post: true },
    });
    if (!report) throw new NotFoundException('신고를 찾을 수 없습니다.');

    await this.prisma.postReport.update({
      where: { id: reportId },
      data: { isResolved: true },
    });
    if (hidePost) {
      await this.prisma.post.update({
        where: { id: report.postId },
        data: { isHidden: true },
      });
    }
    return { success: true };
  }

  // ─── 내부 유틸 ───────────────────────────────────────────────────────────

  private formatPost(post: Record<string, any>, userId?: string) {
    const likes: { id: string }[] =
      (post.likes as { id: string }[] | undefined) ?? [];
    // likes 배열은 userId 기준으로 필터된 결과 → 있으면 좋아요한 것
    const isLiked = userId ? likes.length > 0 : false;
    const count = post._count as
      | { likes: number; comments: number }
      | undefined;
    return {
      ...post,
      likeCount: count?.likes ?? 0,
      commentCount: count?.comments ?? 0,
      isLiked,
      likes: undefined,
      _count: undefined,
    };
  }
}

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const notification_service_1 = require("../notification/notification.service");
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
let CommunityService = class CommunityService {
    prisma;
    notificationService;
    constructor(prisma, notificationService) {
        this.prisma = prisma;
        this.notificationService = notificationService;
    }
    async getPosts(category, page = 1, limit = 20, userId) {
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
    async getPostById(id, userId) {
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
            throw new common_1.NotFoundException('게시글을 찾을 수 없습니다.');
        this.prisma.post
            .update({ where: { id }, data: { viewCount: { increment: 1 } } })
            .catch(() => { });
        return this.formatPost(post, userId);
    }
    async createPost(userId, dto) {
        const post = await this.prisma.post.create({
            data: { userId, ...dto },
            select: POST_SELECT,
        });
        return this.formatPost(post, userId);
    }
    async updatePost(id, userId, dto) {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post)
            throw new common_1.NotFoundException('게시글을 찾을 수 없습니다.');
        if (post.userId !== userId)
            throw new common_1.ForbiddenException('본인 게시글만 수정할 수 있습니다.');
        const updated = await this.prisma.post.update({
            where: { id },
            data: dto,
            select: POST_SELECT,
        });
        return this.formatPost(updated, userId);
    }
    async deletePost(id, userId, isAdmin) {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post)
            throw new common_1.NotFoundException('게시글을 찾을 수 없습니다.');
        if (!isAdmin && post.userId !== userId)
            throw new common_1.ForbiddenException('권한이 없습니다.');
        await this.prisma.post.delete({ where: { id } });
    }
    async toggleLike(postId, userId) {
        const existing = await this.prisma.postLike.findUnique({
            where: { postId_userId: { postId, userId } },
        });
        if (existing) {
            await this.prisma.postLike.delete({ where: { id: existing.id } });
            return { liked: false };
        }
        else {
            const [, post] = await Promise.all([
                this.prisma.postLike.create({ data: { postId, userId } }),
                this.prisma.post.findUnique({
                    where: { id: postId },
                    select: { userId: true, title: true },
                }),
            ]);
            if (post && post.userId !== userId) {
                this.notificationService
                    .send(post.userId, 'LIKE', '누군가 당신의 글을 좋아해요 ❤️', `"${post.title}"에 좋아요를 눌렀어요`, { postId })
                    .catch(() => { });
            }
            return { liked: true };
        }
    }
    async addComment(postId, userId, dto) {
        const post = await this.prisma.post.findUnique({
            where: { id: postId },
            select: { userId: true, title: true, isHidden: true },
        });
        if (!post || post.isHidden)
            throw new common_1.NotFoundException('게시글을 찾을 수 없습니다.');
        const [comment, commenter] = await Promise.all([
            this.prisma.postComment.create({
                data: { postId, userId, body: dto.body },
                select: {
                    id: true,
                    body: true,
                    createdAt: true,
                    user: {
                        select: { id: true, nickname: true, name: true, avatarUrl: true },
                    },
                },
            }),
            this.prisma.user.findUnique({
                where: { id: userId },
                select: { nickname: true, name: true },
            }),
        ]);
        if (post.userId !== userId) {
            const authorName = commenter?.nickname ?? commenter?.name ?? '누군가';
            this.notificationService
                .send(post.userId, 'COMMENT', `${authorName}님이 댓글을 달았어요 💬`, `"${post.title}" 에 댓달: ${dto.body}`, { postId })
                .catch(() => { });
        }
        return comment;
    }
    async deleteComment(commentId, userId, isAdmin) {
        const comment = await this.prisma.postComment.findUnique({
            where: { id: commentId },
        });
        if (!comment)
            throw new common_1.NotFoundException('댓글을 찾을 수 없습니다.');
        if (!isAdmin && comment.userId !== userId)
            throw new common_1.ForbiddenException('권한이 없습니다.');
        await this.prisma.postComment.delete({ where: { id: commentId } });
    }
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
    async getNoticeById(id) {
        const notice = await this.prisma.notice.findUnique({ where: { id } });
        if (!notice)
            throw new common_1.NotFoundException('공지사항을 찾을 수 없습니다.');
        return notice;
    }
    createNotice(dto) {
        return this.prisma.notice.create({ data: dto });
    }
    async updateNotice(id, dto) {
        const notice = await this.prisma.notice.findUnique({ where: { id } });
        if (!notice)
            throw new common_1.NotFoundException('공지사항을 찾을 수 없습니다.');
        return this.prisma.notice.update({ where: { id }, data: dto });
    }
    async deleteNotice(id) {
        const notice = await this.prisma.notice.findUnique({ where: { id } });
        if (!notice)
            throw new common_1.NotFoundException('공지사항을 찾을 수 없습니다.');
        await this.prisma.notice.delete({ where: { id } });
    }
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
    async adminToggleHidden(id) {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post)
            throw new common_1.NotFoundException('게시글을 찾을 수 없습니다.');
        return this.prisma.post.update({
            where: { id },
            data: { isHidden: !post.isHidden },
        });
    }
    async adminTogglePinned(id) {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post)
            throw new common_1.NotFoundException('게시글을 찾을 수 없습니다.');
        return this.prisma.post.update({
            where: { id },
            data: { isPinned: !post.isPinned },
        });
    }
    async reportPost(postId, userId, dto) {
        const post = await this.prisma.post.findUnique({ where: { id: postId } });
        if (!post)
            throw new common_1.NotFoundException('게시글을 찾을 수 없습니다.');
        if (post.userId === userId)
            throw new common_1.ForbiddenException('자신의 게시글을 신고할 수 없습니다.');
        try {
            await this.prisma.postReport.create({
                data: { postId, userId, reason: dto.reason, detail: dto.detail },
            });
            return {
                success: true,
                message: '신고가 접수됐어요. 관리자가 검토 후 조치할게요.',
            };
        }
        catch {
            throw new common_1.ForbiddenException('이미 신고한 게시글이에요.');
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
    async adminResolveReport(reportId, hidePost) {
        const report = await this.prisma.postReport.findUnique({
            where: { id: reportId },
            include: { post: true },
        });
        if (!report)
            throw new common_1.NotFoundException('신고를 찾을 수 없습니다.');
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
    formatPost(post, userId) {
        const likes = post.likes ?? [];
        const isLiked = userId ? likes.length > 0 : false;
        const count = post._count;
        return {
            ...post,
            likeCount: count?.likes ?? 0,
            commentCount: count?.comments ?? 0,
            isLiked,
            likes: undefined,
            _count: undefined,
        };
    }
};
exports.CommunityService = CommunityService;
exports.CommunityService = CommunityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService])
], CommunityService);
//# sourceMappingURL=community.service.js.map
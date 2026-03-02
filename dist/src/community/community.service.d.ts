import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { PostCategory } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
export declare class CommunityService {
    private readonly prisma;
    private readonly notificationService;
    constructor(prisma: PrismaService, notificationService: NotificationService);
    getPosts(category?: PostCategory, page?: number, limit?: number, userId?: string): Promise<{
        items: {
            likeCount: number;
            commentCount: number;
            isLiked: boolean;
            likes: undefined;
            _count: undefined;
        }[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    getPostById(id: string, userId?: string): Promise<{
        likeCount: number;
        commentCount: number;
        isLiked: boolean;
        likes: undefined;
        _count: undefined;
    }>;
    createPost(userId: string, dto: CreatePostDto): Promise<{
        likeCount: number;
        commentCount: number;
        isLiked: boolean;
        likes: undefined;
        _count: undefined;
    }>;
    updatePost(id: string, userId: string, dto: Partial<CreatePostDto>): Promise<{
        likeCount: number;
        commentCount: number;
        isLiked: boolean;
        likes: undefined;
        _count: undefined;
    }>;
    deletePost(id: string, userId: string, isAdmin: boolean): Promise<void>;
    toggleLike(postId: string, userId: string): Promise<{
        liked: boolean;
    }>;
    addComment(postId: string, userId: string, dto: CreateCommentDto): Promise<{
        id: string;
        createdAt: Date;
        user: {
            id: string;
            name: string;
            nickname: string | null;
            avatarUrl: string | null;
        };
        body: string;
    }>;
    deleteComment(commentId: string, userId: string, isAdmin: boolean): Promise<void>;
    getNotices(page?: number, limit?: number): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            body: string;
            isPinned: boolean;
        }[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    getNoticeById(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        body: string;
        isPinned: boolean;
    }>;
    createNotice(dto: CreateNoticeDto): import("@prisma/client").Prisma.Prisma__NoticeClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        body: string;
        isPinned: boolean;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    updateNotice(id: string, dto: Partial<CreateNoticeDto>): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        body: string;
        isPinned: boolean;
    }>;
    deleteNotice(id: string): Promise<void>;
    adminGetPosts(page?: number, limit?: number): Promise<{
        items: {
            id: string;
            category: import("@prisma/client").$Enums.PostCategory;
            createdAt: Date;
            _count: {
                comments: number;
                likes: number;
            };
            user: {
                id: string;
                name: string;
                nickname: string | null;
            };
            title: string;
            isPinned: boolean;
            isHidden: boolean;
            viewCount: number;
        }[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    adminToggleHidden(id: string): Promise<{
        id: string;
        category: import("@prisma/client").$Enums.PostCategory;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
        body: string;
        imageUrl: string | null;
        isPinned: boolean;
        isHidden: boolean;
        viewCount: number;
    }>;
    adminTogglePinned(id: string): Promise<{
        id: string;
        category: import("@prisma/client").$Enums.PostCategory;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
        body: string;
        imageUrl: string | null;
        isPinned: boolean;
        isHidden: boolean;
        viewCount: number;
    }>;
    reportPost(postId: string, userId: string, dto: CreateReportDto): Promise<{
        success: boolean;
        message: string;
    }>;
    adminGetReports(page?: number, limit?: number, onlyUnresolved?: boolean): Promise<{
        items: ({
            user: {
                id: string;
                name: string;
                nickname: string | null;
            };
            post: {
                id: string;
                category: import("@prisma/client").$Enums.PostCategory;
                title: string;
                isHidden: boolean;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            reason: import("@prisma/client").$Enums.ReportReason;
            detail: string | null;
            postId: string;
            isResolved: boolean;
        })[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    adminResolveReport(reportId: string, hidePost: boolean): Promise<{
        success: boolean;
    }>;
    private formatPost;
}

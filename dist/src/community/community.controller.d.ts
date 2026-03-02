import { PostCategory } from '@prisma/client';
import { Request } from 'express';
import { CommunityService } from './community.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateReportDto } from './dto/create-report.dto';
interface AuthRequest extends Request {
    user: {
        id: string;
        isAdmin: boolean;
    };
}
interface OptionalAuthRequest extends Request {
    user?: {
        id: string;
        isAdmin: boolean;
    };
}
export declare class CommunityController {
    private readonly communityService;
    constructor(communityService: CommunityService);
    getNotices(page?: string, limit?: string): Promise<{
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
    createNotice(req: AuthRequest, dto: CreateNoticeDto): import("@prisma/client").Prisma.Prisma__NoticeClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        body: string;
        isPinned: boolean;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    updateNotice(req: AuthRequest, id: string, dto: Partial<CreateNoticeDto>): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        body: string;
        isPinned: boolean;
    }>;
    deleteNotice(req: AuthRequest, id: string): Promise<void>;
    getPosts(category?: PostCategory, page?: string, limit?: string, req?: OptionalAuthRequest): Promise<{
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
    getPostById(id: string, req: OptionalAuthRequest): Promise<{
        likeCount: number;
        commentCount: number;
        isLiked: boolean;
        likes: undefined;
        _count: undefined;
    }>;
    createPost(req: AuthRequest, dto: CreatePostDto): Promise<{
        likeCount: number;
        commentCount: number;
        isLiked: boolean;
        likes: undefined;
        _count: undefined;
    }>;
    updatePost(req: AuthRequest, id: string, dto: Partial<CreatePostDto>): Promise<{
        likeCount: number;
        commentCount: number;
        isLiked: boolean;
        likes: undefined;
        _count: undefined;
    }>;
    deletePost(req: AuthRequest, id: string): Promise<void>;
    toggleLike(req: AuthRequest, id: string): Promise<{
        liked: boolean;
    }>;
    addComment(req: AuthRequest, id: string, dto: CreateCommentDto): Promise<{
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
    deleteComment(req: AuthRequest, id: string): Promise<void>;
    reportPost(req: AuthRequest, id: string, dto: CreateReportDto): Promise<{
        success: boolean;
        message: string;
    }>;
    adminGetPosts(req: AuthRequest, page?: string, limit?: string): Promise<{
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
    adminToggleHidden(req: AuthRequest, id: string): Promise<{
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
    adminTogglePinned(req: AuthRequest, id: string): Promise<{
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
    adminGetReports(req: AuthRequest, page?: string, limit?: string, unresolved?: string): Promise<{
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
    adminResolveReport(req: AuthRequest, id: string, hidePost?: boolean): Promise<{
        success: boolean;
    }>;
    private assertAdmin;
}
export {};

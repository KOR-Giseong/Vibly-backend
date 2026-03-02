import { Request } from 'express';
import { SupportService } from './support.service';
import { R2Service } from '../storage/r2.service';
interface AuthRequest extends Request {
    user: {
        id: string;
        isAdmin: boolean;
    };
}
export declare class SupportController {
    private supportService;
    private r2;
    constructor(supportService: SupportService, r2: R2Service);
    getFaqCategories(): {
        category: string;
        questions: string[];
    }[];
    createTicket(req: AuthRequest, body: {
        title: string;
        body: string;
        type?: 'FAQ' | 'CHAT';
    }): Promise<{
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.TicketStatus;
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
    }>;
    getMyTickets(req: AuthRequest): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.TicketStatus;
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
        messages: {
            createdAt: Date;
            isAdmin: boolean;
            body: string;
        }[];
        adminReply: string | null;
        repliedAt: Date | null;
    }[]>;
    getMessages(req: AuthRequest, id: string): Promise<{
        id: string;
        createdAt: Date;
        isAdmin: boolean;
        body: string;
        imageUrl: string | null;
        senderId: string;
        readAt: Date | null;
        ticketId: string;
    }[]>;
    uploadImage(file: Express.Multer.File): Promise<{
        imageUrl: string;
    }>;
    sendMessage(req: AuthRequest, id: string, body: {
        body: string;
        imageUrl?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        isAdmin: boolean;
        body: string;
        imageUrl: string | null;
        senderId: string;
        readAt: Date | null;
        ticketId: string;
    }>;
    getAllTickets(req: AuthRequest): Promise<({
        user: {
            id: string;
            name: string;
            email: string | null;
            nickname: string | null;
            avatarUrl: string | null;
        };
        messages: {
            createdAt: Date;
            isAdmin: boolean;
            body: string;
            readAt: Date | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import("@prisma/client").$Enums.TicketStatus;
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
        adminReply: string | null;
        repliedAt: Date | null;
    })[]>;
    getTicketMessages(req: AuthRequest, id: string): Promise<{
        id: string;
        createdAt: Date;
        isAdmin: boolean;
        body: string;
        imageUrl: string | null;
        senderId: string;
        readAt: Date | null;
        ticketId: string;
    }[]>;
    adminSendMessage(req: AuthRequest, id: string, body: {
        body: string;
        imageUrl?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        isAdmin: boolean;
        body: string;
        imageUrl: string | null;
        senderId: string;
        readAt: Date | null;
        ticketId: string;
    }>;
    replyTicket(req: AuthRequest, id: string, body: {
        reply: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import("@prisma/client").$Enums.TicketStatus;
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
        adminReply: string | null;
        repliedAt: Date | null;
    }>;
    updateTicketStatus(req: AuthRequest, id: string, body: {
        status: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import("@prisma/client").$Enums.TicketStatus;
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
        adminReply: string | null;
        repliedAt: Date | null;
    }>;
    getUsers(req: AuthRequest): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        _count: {
            checkIns: number;
            bookmarks: number;
            reviews: number;
        };
        email: string | null;
        nickname: string | null;
        avatarUrl: string | null;
        isProfileComplete: boolean;
        provider: import("@prisma/client").$Enums.AuthProvider;
        status: import("@prisma/client").$Enums.UserStatus;
        isAdmin: boolean;
        suspendedUntil: Date | null;
        suspendReason: string | null;
    }[]>;
    suspendUser(req: AuthRequest, id: string, body: {
        reason: string;
        suspendedUntil: string;
    }): Promise<{
        id: string;
        name: string;
        status: import("@prisma/client").$Enums.UserStatus;
        suspendedUntil: Date | null;
        suspendReason: string | null;
    }>;
    unsuspendUser(req: AuthRequest, id: string): Promise<{
        id: string;
        name: string;
        status: import("@prisma/client").$Enums.UserStatus;
    }>;
    toggleAdmin(req: AuthRequest, id: string): Promise<{
        id: string;
        name: string;
        isAdmin: boolean;
    }>;
    getAdminStats(req: AuthRequest): Promise<{
        totalUsers: number;
        newUsersThisWeek: number;
        totalTickets: number;
        openTickets: number;
        totalCheckIns: number;
        checkInsThisWeek: number;
        totalPlaces: number;
        activePlaces: number;
        totalReviews: number;
        usersByDay: {
            date: string;
            count: number;
        }[];
        checkinsByDay: {
            date: string;
            count: number;
        }[];
        popularPlaces: {
            id: string;
            name: string;
            category: import("@prisma/client").$Enums.PlaceCategory;
            rating: number;
            reviewCount: number;
            _count: {
                checkIns: number;
                bookmarks: number;
            };
        }[];
    }>;
    getAdminPlaces(req: AuthRequest): Promise<{
        id: string;
        name: string;
        category: import("@prisma/client").$Enums.PlaceCategory;
        address: string;
        rating: number;
        reviewCount: number;
        vibeScore: number;
        isActive: boolean;
        createdAt: Date;
        _count: {
            checkIns: number;
            bookmarks: number;
            reviews: number;
        };
    }[]>;
    togglePlaceActive(req: AuthRequest, id: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
    }>;
    getAdminCheckIns(req: AuthRequest, page?: string, limit?: string): Promise<{
        total: number;
        page: number;
        limit: number;
        items: ({
            place: {
                id: string;
                name: string;
                category: import("@prisma/client").$Enums.PlaceCategory;
            };
            user: {
                id: string;
                name: string;
                nickname: string | null;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            note: string | null;
            placeId: string;
            imageUrl: string | null;
            mood: string;
            receiptVerified: boolean;
            receiptHash: string | null;
        })[];
    }>;
    deleteAdminCheckIn(req: AuthRequest, id: string): Promise<{
        success: boolean;
    }>;
    getAdminReviews(req: AuthRequest, page?: string, limit?: string): Promise<{
        total: number;
        page: number;
        limit: number;
        items: ({
            place: {
                id: string;
                name: string;
                category: import("@prisma/client").$Enums.PlaceCategory;
            };
            user: {
                id: string;
                name: string;
                nickname: string | null;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            rating: number;
            createdAt: Date;
            userId: string;
            body: string;
            placeId: string;
        })[];
    }>;
    deleteAdminReview(req: AuthRequest, id: string): Promise<{
        success: boolean;
    }>;
}
export {};

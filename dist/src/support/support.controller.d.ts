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
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
        status: import("@prisma/client").$Enums.TicketStatus;
        createdAt: Date;
    }>;
    getMyTickets(req: AuthRequest): Promise<{
        id: string;
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
        status: import("@prisma/client").$Enums.TicketStatus;
        adminReply: string | null;
        repliedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        messages: {
            body: string;
            createdAt: Date;
            isAdmin: boolean;
        }[];
    }[]>;
    getMessages(req: AuthRequest, id: string): Promise<{
        id: string;
        body: string;
        createdAt: Date;
        ticketId: string;
        senderId: string;
        isAdmin: boolean;
        imageUrl: string | null;
        readAt: Date | null;
    }[]>;
    uploadImage(file: Express.Multer.File): Promise<{
        imageUrl: string;
    }>;
    sendMessage(req: AuthRequest, id: string, body: {
        body: string;
        imageUrl?: string;
    }): Promise<{
        id: string;
        body: string;
        createdAt: Date;
        ticketId: string;
        senderId: string;
        isAdmin: boolean;
        imageUrl: string | null;
        readAt: Date | null;
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
            body: string;
            createdAt: Date;
            isAdmin: boolean;
            readAt: Date | null;
        }[];
    } & {
        id: string;
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
        status: import("@prisma/client").$Enums.TicketStatus;
        adminReply: string | null;
        repliedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    })[]>;
    getTicketMessages(req: AuthRequest, id: string): Promise<{
        id: string;
        body: string;
        createdAt: Date;
        ticketId: string;
        senderId: string;
        isAdmin: boolean;
        imageUrl: string | null;
        readAt: Date | null;
    }[]>;
    adminSendMessage(req: AuthRequest, id: string, body: {
        body: string;
        imageUrl?: string;
    }): Promise<{
        id: string;
        body: string;
        createdAt: Date;
        ticketId: string;
        senderId: string;
        isAdmin: boolean;
        imageUrl: string | null;
        readAt: Date | null;
    }>;
    replyTicket(req: AuthRequest, id: string, body: {
        reply: string;
    }): Promise<{
        id: string;
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
        status: import("@prisma/client").$Enums.TicketStatus;
        adminReply: string | null;
        repliedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    }>;
    updateTicketStatus(req: AuthRequest, id: string, body: {
        status: string;
    }): Promise<{
        id: string;
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
        status: import("@prisma/client").$Enums.TicketStatus;
        adminReply: string | null;
        repliedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    }>;
    getUsers(req: AuthRequest): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
        _count: {
            bookmarks: number;
            checkIns: number;
            reviews: number;
        };
        name: string;
        isAdmin: boolean;
        email: string | null;
        nickname: string | null;
        avatarUrl: string | null;
        isProfileComplete: boolean;
        provider: import("@prisma/client").$Enums.AuthProvider;
        suspendedUntil: Date | null;
        suspendReason: string | null;
    }[]>;
    suspendUser(req: AuthRequest, id: string, body: {
        reason: string;
        suspendedUntil: string;
    }): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.UserStatus;
        name: string;
        suspendedUntil: Date | null;
        suspendReason: string | null;
    }>;
    unsuspendUser(req: AuthRequest, id: string): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.UserStatus;
        name: string;
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
            _count: {
                bookmarks: number;
                checkIns: number;
            };
            name: string;
            category: import("@prisma/client").$Enums.PlaceCategory;
            rating: number;
            reviewCount: number;
        }[];
    }>;
    getAdminPlaces(req: AuthRequest): Promise<{
        id: string;
        createdAt: Date;
        _count: {
            bookmarks: number;
            checkIns: number;
            reviews: number;
        };
        name: string;
        isActive: boolean;
        category: import("@prisma/client").$Enums.PlaceCategory;
        address: string;
        rating: number;
        reviewCount: number;
        vibeScore: number;
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
            user: {
                id: string;
                name: string;
                nickname: string | null;
                avatarUrl: string | null;
            };
            place: {
                id: string;
                name: string;
                category: import("@prisma/client").$Enums.PlaceCategory;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            imageUrl: string | null;
            placeId: string;
            mood: string;
            note: string | null;
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
            user: {
                id: string;
                name: string;
                nickname: string | null;
                avatarUrl: string | null;
            };
            place: {
                id: string;
                name: string;
                category: import("@prisma/client").$Enums.PlaceCategory;
            };
        } & {
            id: string;
            body: string;
            createdAt: Date;
            userId: string;
            placeId: string;
            rating: number;
        })[];
    }>;
    deleteAdminReview(req: AuthRequest, id: string): Promise<{
        success: boolean;
    }>;
}
export {};

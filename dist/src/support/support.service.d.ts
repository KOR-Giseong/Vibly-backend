import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
export declare class SupportService {
    private prisma;
    private notificationService;
    constructor(prisma: PrismaService, notificationService: NotificationService);
    getFaqCategories(): {
        category: string;
        questions: string[];
    }[];
    createTicket(userId: string, title: string, body: string, type?: 'FAQ' | 'CHAT'): Promise<{
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.TicketStatus;
        type: import("@prisma/client").$Enums.TicketType;
        title: string;
        body: string;
    }>;
    getMyTickets(userId: string): Promise<{
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
    getMessages(userId: string, ticketId: string): Promise<{
        id: string;
        createdAt: Date;
        isAdmin: boolean;
        body: string;
        imageUrl: string | null;
        senderId: string;
        readAt: Date | null;
        ticketId: string;
    }[]>;
    sendMessage(userId: string, ticketId: string, body: string, imageUrl?: string): Promise<{
        id: string;
        createdAt: Date;
        isAdmin: boolean;
        body: string;
        imageUrl: string | null;
        senderId: string;
        readAt: Date | null;
        ticketId: string;
    }>;
    getAllTickets(adminId: string): Promise<({
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
    getTicketMessages(adminId: string, ticketId: string): Promise<{
        id: string;
        createdAt: Date;
        isAdmin: boolean;
        body: string;
        imageUrl: string | null;
        senderId: string;
        readAt: Date | null;
        ticketId: string;
    }[]>;
    adminSendMessage(adminId: string, ticketId: string, body: string, imageUrl?: string): Promise<{
        id: string;
        createdAt: Date;
        isAdmin: boolean;
        body: string;
        imageUrl: string | null;
        senderId: string;
        readAt: Date | null;
        ticketId: string;
    }>;
    replyTicket(adminId: string, ticketId: string, reply: string): Promise<{
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
    updateTicketStatus(adminId: string, ticketId: string, status: string): Promise<{
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
    getUsers(adminId: string): Promise<{
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
    suspendUser(adminId: string, targetId: string, reason: string, suspendedUntil: Date): Promise<{
        id: string;
        name: string;
        status: import("@prisma/client").$Enums.UserStatus;
        suspendedUntil: Date | null;
        suspendReason: string | null;
    }>;
    unsuspendUser(adminId: string, targetId: string): Promise<{
        id: string;
        name: string;
        status: import("@prisma/client").$Enums.UserStatus;
    }>;
    toggleAdmin(adminId: string, targetUserId: string): Promise<{
        id: string;
        name: string;
        isAdmin: boolean;
    }>;
    getAdminStats(adminId: string): Promise<{
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
    getAdminPlaces(adminId: string): Promise<{
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
    togglePlaceActive(adminId: string, placeId: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
    }>;
    getAdminCheckIns(adminId: string, page?: number, limit?: number): Promise<{
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
    deleteAdminCheckIn(adminId: string, checkInId: string): Promise<{
        success: boolean;
    }>;
    getAdminReviews(adminId: string, page?: number, limit?: number): Promise<{
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
    deleteAdminReview(adminId: string, reviewId: string): Promise<{
        success: boolean;
    }>;
    private assertAdmin;
}

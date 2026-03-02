import { PrismaService } from '../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { KakaoService } from '../place/kakao.service';
import { NotificationService } from '../notification/notification.service';
import { R2Service } from '../storage/r2.service';
export declare class CoupleService {
    private prisma;
    private creditService;
    private kakao;
    private notificationService;
    private r2;
    private readonly logger;
    constructor(prisma: PrismaService, creditService: CreditService, kakao: KakaoService, notificationService: NotificationService, r2: R2Service);
    findMyCouple(userId: string): Promise<({
        user1: {
            id: string;
            name: string;
            nickname: string | null;
            avatarUrl: string | null;
            gender: string | null;
            preferredVibes: string[];
            credits: number;
        };
        user2: {
            id: string;
            name: string;
            nickname: string | null;
            avatarUrl: string | null;
            gender: string | null;
            preferredVibes: string[];
            credits: number;
        };
    } & {
        id: string;
        user1Id: string;
        user2Id: string;
        status: import("@prisma/client").$Enums.CoupleStatus;
        creditShareEnabled: boolean;
        anniversaryDate: Date | null;
        dissolvedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    getMyCoupleInfo(userId: string): Promise<{
        coupleId: string;
        partnerId: string;
        partnerName: string;
        partnerAvatarUrl: string | null;
        creditShareEnabled: boolean;
        anniversaryDate: Date | null;
        createdAt: Date;
    } | null>;
    searchUserForInvite(query: string, requesterId: string): Promise<{
        id: string;
        email: string | null;
        name: string;
        nickname: string | null;
        avatarUrl: string | null;
        gender: string | null;
    }[]>;
    sendInvitation(senderId: string, receiverId: string, message?: string): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.InvitationStatus;
        createdAt: Date;
        message: string | null;
        respondedAt: Date | null;
        senderId: string;
        receiverId: string;
    }>;
    getReceivedInvitations(userId: string): Promise<({
        sender: {
            id: string;
            name: string;
            nickname: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.InvitationStatus;
        createdAt: Date;
        message: string | null;
        respondedAt: Date | null;
        senderId: string;
        receiverId: string;
    })[]>;
    getSentInvitations(userId: string): Promise<({
        receiver: {
            id: string;
            name: string;
            nickname: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.InvitationStatus;
        createdAt: Date;
        message: string | null;
        respondedAt: Date | null;
        senderId: string;
        receiverId: string;
    })[]>;
    respondToInvitation(invitationId: string, userId: string, accept: boolean): Promise<{
        success: boolean;
        coupled: boolean;
        coupleId?: undefined;
    } | {
        success: boolean;
        coupled: boolean;
        coupleId: string;
    }>;
    cancelInvitation(invitationId: string, userId: string): Promise<{
        success: boolean;
    }>;
    dissolveCouple(userId: string): Promise<{
        success: boolean;
    }>;
    toggleCreditShare(userId: string, enabled: boolean): Promise<{
        creditShareEnabled: boolean;
    }>;
    transferCreditsToPartner(userId: string, amount: number): Promise<{
        credits: number;
        sent: number;
    }>;
    getCreditHistory(userId: string, limit?: number): Promise<{
        id: string;
        senderId: string;
        senderName: string;
        senderAvatarUrl: string | null;
        amount: number;
        createdAt: string;
        isMine: boolean;
    }[]>;
    getPartnerBookmarks(userId: string): Promise<{
        id: string;
        name: string;
        category: import("@prisma/client").$Enums.PlaceCategory;
        address: string;
        lat: number;
        lng: number;
        rating: number;
        reviewCount: number;
        imageUrl: string | null;
        tags: any[];
    }[]>;
    getPartnerProfile(userId: string): Promise<{
        id: string;
        name: string;
        nickname: string | null;
        avatarUrl: string | null;
        gender: string | null;
        preferredVibes: string[];
        credits: number;
        stats: {
            checkinCount: number;
            bookmarkCount: number;
            reviewCount: number;
        };
    }>;
    getDatePlans(userId: string): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.DatePlanStatus;
        createdAt: Date;
        updatedAt: Date;
        coupleId: string;
        title: string;
        dateAt: Date;
        memo: string | null;
        placeIds: string[];
    }[]>;
    createDatePlan(userId: string, data: {
        title: string;
        dateAt: Date;
        memo?: string;
        placeIds?: string[];
    }): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.DatePlanStatus;
        createdAt: Date;
        updatedAt: Date;
        coupleId: string;
        title: string;
        dateAt: Date;
        memo: string | null;
        placeIds: string[];
    }>;
    updateDatePlan(userId: string, planId: string, data: {
        title?: string;
        dateAt?: Date;
        memo?: string;
        status?: 'PLANNED' | 'COMPLETED' | 'CANCELLED';
        placeIds?: string[];
    }): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.DatePlanStatus;
        createdAt: Date;
        updatedAt: Date;
        coupleId: string;
        title: string;
        dateAt: Date;
        memo: string | null;
        placeIds: string[];
    }>;
    deleteDatePlan(userId: string, planId: string): Promise<{
        success: boolean;
    }>;
    private extractDateKeywords;
    private searchKakaoForDate;
    aiDateAnalysis(userId: string, userNote?: string): Promise<any>;
    aiRefineTimeline(userId: string, timeline: any[], feedback: string): Promise<any>;
    getMemories(userId: string, page?: number, limit?: number): Promise<{
        items: {
            imageUrl: string;
            id: string;
            createdAt: Date;
            coupleId: string;
            uploaderId: string;
            caption: string | null;
            takenAt: Date | null;
        }[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    uploadMemory(userId: string, data: {
        base64: string;
        caption?: string;
        takenAt?: Date;
    }): Promise<{
        id: string;
        createdAt: Date;
        coupleId: string;
        uploaderId: string;
        imageUrl: string;
        caption: string | null;
        takenAt: Date | null;
    }>;
    deleteMemory(userId: string, memoryId: string): Promise<{
        success: boolean;
    }>;
    setAnniversaryDate(userId: string, anniversaryDate: Date): Promise<{
        anniversaryDate: Date | null;
    }>;
    adminGetCouples(adminId: string, page?: number, limit?: number, status?: string): Promise<{
        items: ({
            user1: {
                id: string;
                email: string | null;
                name: string;
                nickname: string | null;
                avatarUrl: string | null;
            };
            user2: {
                id: string;
                email: string | null;
                name: string;
                nickname: string | null;
                avatarUrl: string | null;
            };
            _count: {
                datePlans: number;
                memories: number;
            };
        } & {
            id: string;
            user1Id: string;
            user2Id: string;
            status: import("@prisma/client").$Enums.CoupleStatus;
            creditShareEnabled: boolean;
            anniversaryDate: Date | null;
            dissolvedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        })[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    adminDissolveCouple(adminId: string, coupleId: string): Promise<{
        success: boolean;
    }>;
    reportUser(reporterId: string, dto: {
        reportedId: string;
        reason: string;
        detail?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        reason: import("@prisma/client").$Enums.ReportReason;
        detail: string | null;
        isResolved: boolean;
        reporterId: string;
        reportedId: string;
    }>;
    adminGetUserReports(adminId: string, page?: number, limit?: number, onlyUnresolved?: boolean): Promise<{
        items: ({
            reporter: {
                id: string;
                name: string;
                nickname: string | null;
            };
            reported: {
                id: string;
                name: string;
                nickname: string | null;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            reason: import("@prisma/client").$Enums.ReportReason;
            detail: string | null;
            isResolved: boolean;
            reporterId: string;
            reportedId: string;
        })[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    adminResolveUserReport(adminId: string, reportId: string): Promise<{
        success: boolean;
    }>;
    getMessages(userId: string, page?: number, limit?: number): Promise<{
        items: {
            imageUrl: string | null;
            id: string;
            createdAt: Date;
            senderId: string;
            coupleId: string;
            type: import("@prisma/client").$Enums.MessageType;
            text: string | null;
            emoji: string | null;
            readAt: Date | null;
        }[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    sendMessage(userId: string, dto: {
        type: 'TEXT' | 'IMAGE' | 'EMOJI';
        text?: string;
        imageBase64?: string;
        emoji?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        senderId: string;
        coupleId: string;
        type: import("@prisma/client").$Enums.MessageType;
        imageUrl: string | null;
        text: string | null;
        emoji: string | null;
        readAt: Date | null;
    }>;
    markMessagesRead(userId: string): Promise<{
        updated: number;
    }>;
    aiDateChat(userId: string, messages: Array<{
        role: 'user' | 'model';
        text: string;
    }>, lat?: number, lng?: number): Promise<{
        text: string;
        places: any[] | undefined;
    }>;
    private assertAdmin;
}

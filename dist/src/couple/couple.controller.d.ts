import { CoupleService } from './couple.service';
export declare class CoupleController {
    private coupleService;
    constructor(coupleService: CoupleService);
    getMe(req: any): Promise<{
        coupleId: string;
        partnerId: string;
        partnerName: string;
        partnerAvatarUrl: string | null;
        creditShareEnabled: boolean;
        anniversaryDate: Date | null;
        createdAt: Date;
    } | null>;
    searchUser(req: any, q: string): Promise<{
        id: string;
        name: string;
        email: string | null;
        nickname: string | null;
        avatarUrl: string | null;
        gender: string | null;
    }[]>;
    sendInvitation(req: any, body: {
        receiverId: string;
        message?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.InvitationStatus;
        message: string | null;
        senderId: string;
        receiverId: string;
        respondedAt: Date | null;
    }>;
    getReceivedInvitations(req: any): Promise<({
        sender: {
            id: string;
            name: string;
            nickname: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.InvitationStatus;
        message: string | null;
        senderId: string;
        receiverId: string;
        respondedAt: Date | null;
    })[]>;
    getSentInvitations(req: any): Promise<({
        receiver: {
            id: string;
            name: string;
            nickname: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.InvitationStatus;
        message: string | null;
        senderId: string;
        receiverId: string;
        respondedAt: Date | null;
    })[]>;
    respondToInvitation(req: any, id: string, body: {
        accept: boolean;
    }): Promise<{
        success: boolean;
        coupled: boolean;
        coupleId?: undefined;
    } | {
        success: boolean;
        coupled: boolean;
        coupleId: string;
    }>;
    cancelInvitation(req: any, id: string): Promise<{
        success: boolean;
    }>;
    dissolveCouple(req: any): Promise<{
        success: boolean;
    }>;
    toggleCreditShare(req: any, body: {
        enabled: boolean;
    }): Promise<{
        creditShareEnabled: boolean;
    }>;
    transferCredits(req: any, body: {
        amount: number;
    }): Promise<{
        credits: number;
        sent: number;
    }>;
    getCreditHistory(req: any): Promise<{
        id: string;
        senderId: string;
        senderName: string;
        senderAvatarUrl: string | null;
        amount: number;
        createdAt: string;
        isMine: boolean;
    }[]>;
    getPartnerBookmarks(req: any): Promise<{
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
    getPartnerProfile(req: any): Promise<{
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
    setAnniversary(req: any, body: {
        anniversaryDate: string;
    }): Promise<{
        anniversaryDate: Date | null;
    }>;
    getDatePlans(req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.DatePlanStatus;
        title: string;
        coupleId: string;
        dateAt: Date;
        memo: string | null;
        placeIds: string[];
    }[]>;
    createDatePlan(req: any, body: {
        title: string;
        dateAt: string;
        memo?: string;
        placeIds?: string[];
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.DatePlanStatus;
        title: string;
        coupleId: string;
        dateAt: Date;
        memo: string | null;
        placeIds: string[];
    }>;
    updateDatePlan(req: any, id: string, body: {
        title?: string;
        dateAt?: string;
        memo?: string;
        status?: 'PLANNED' | 'COMPLETED' | 'CANCELLED';
        placeIds?: string[];
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.DatePlanStatus;
        title: string;
        coupleId: string;
        dateAt: Date;
        memo: string | null;
        placeIds: string[];
    }>;
    deleteDatePlan(req: any, id: string): Promise<{
        success: boolean;
    }>;
    aiDateAnalysis(req: any, body: {
        userNote?: string;
    }): Promise<any>;
    aiRefineTimeline(req: any, body: {
        timeline: any[];
        feedback: string;
    }): Promise<any>;
    getMemories(req: any, page?: string, limit?: string): Promise<{
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
    uploadMemory(req: any, body: {
        imageBase64: string;
        caption?: string;
        takenAt?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        coupleId: string;
        imageUrl: string;
        uploaderId: string;
        caption: string | null;
        takenAt: Date | null;
    }>;
    deleteMemory(req: any, id: string): Promise<{
        success: boolean;
    }>;
    reportUser(req: any, body: {
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
    adminGetUserReports(req: any, page?: string, limit?: string, unresolved?: string): Promise<{
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
    adminResolveUserReport(req: any, id: string): Promise<{
        success: boolean;
    }>;
    adminGetCouples(req: any, page?: string, limit?: string, status?: string): Promise<{
        items: ({
            _count: {
                datePlans: number;
                memories: number;
            };
            user1: {
                id: string;
                name: string;
                email: string | null;
                nickname: string | null;
                avatarUrl: string | null;
            };
            user2: {
                id: string;
                name: string;
                email: string | null;
                nickname: string | null;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.CoupleStatus;
            creditShareEnabled: boolean;
            anniversaryDate: Date | null;
            user1Id: string;
            user2Id: string;
            dissolvedAt: Date | null;
        })[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    adminDissolveCouple(req: any, id: string): Promise<{
        success: boolean;
    }>;
    getMessages(req: any, page?: string, limit?: string): Promise<{
        items: {
            imageUrl: string | null;
            id: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.MessageType;
            text: string | null;
            coupleId: string;
            senderId: string;
            readAt: Date | null;
            emoji: string | null;
        }[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    sendMessage(req: any, body: {
        type: 'TEXT' | 'IMAGE' | 'EMOJI';
        text?: string;
        imageBase64?: string;
        emoji?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.MessageType;
        text: string | null;
        coupleId: string;
        imageUrl: string | null;
        senderId: string;
        readAt: Date | null;
        emoji: string | null;
    }>;
    markMessagesRead(req: any): Promise<{
        updated: number;
    }>;
    aiDateChat(req: any, body: {
        messages: Array<{
            role: 'user' | 'model';
            text: string;
        }>;
        lat?: number;
        lng?: number;
    }): Promise<{
        text: string;
        places: any[] | undefined;
    }>;
}

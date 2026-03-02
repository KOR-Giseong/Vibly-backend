import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreditTxType, SubscriptionPlatform, SubscriptionType } from '@prisma/client';
export { CreditTxType, SubscriptionType, SubscriptionPlatform };
export declare const CREDIT_COSTS: {
    readonly MOOD_SEARCH_BASIC: 5;
    readonly MOOD_SEARCH_AI: 10;
};
export declare const CREDIT_REWARDS: {
    readonly SIGNUP_BONUS: 100;
    readonly CHECKIN_GPS: 15;
    readonly CHECKIN_RECEIPT: 20;
    readonly AD_WATCH: 15;
};
export declare const AD_DAILY_LIMIT = 5;
export declare class CreditService {
    private prisma;
    private notificationService;
    private readonly logger;
    constructor(prisma: PrismaService, notificationService: NotificationService);
    getBalance(userId: string): Promise<{
        credits: number;
        isPremium: boolean;
    }>;
    isSubscribed(userId: string): Promise<boolean>;
    cancelSubscription(userId: string): Promise<{
        ok: boolean;
        message: string;
    }>;
    spend(userId: string, amount: number, type: CreditTxType, referenceId?: string): Promise<number>;
    earn(userId: string, amount: number, type: CreditTxType, referenceId?: string): Promise<number>;
    watchAd(userId: string): Promise<{
        credits: number;
        earned: number;
        adWatchesToday: number;
    }>;
    getAdWatchesToday(userId: string): Promise<number>;
    getHistory(userId: string, page?: number, limit?: number): Promise<{
        items: {
            id: string;
            createdAt: Date;
            userId: string;
            type: import("@prisma/client").$Enums.CreditTxType;
            amount: number;
            referenceId: string | null;
            note: string | null;
        }[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    adminGetUsersWithCredits(adminId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        nickname: string | null;
        avatarUrl: string | null;
        status: import("@prisma/client").$Enums.UserStatus;
        credits: number;
    }[]>;
    adminAdjustCredits(adminId: string, userId: string, amount: number): Promise<{
        credits: number;
    }>;
    private assertAdmin;
    adminListSubscriptions(adminId: string, page?: number, limit?: number): Promise<{
        items: ({
            user: {
                id: string;
                name: string;
                email: string | null;
                nickname: string | null;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            platform: import("@prisma/client").$Enums.SubscriptionPlatform;
            type: import("@prisma/client").$Enums.SubscriptionType;
            receiptData: string;
            productId: string;
            expiresAt: Date;
            adminId: string | null;
        })[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    adminGrantSubscription(adminId: string, userId: string, type: SubscriptionType, durationDays: number): Promise<{
        user: {
            id: string;
            name: string;
            email: string | null;
            nickname: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        platform: import("@prisma/client").$Enums.SubscriptionPlatform;
        type: import("@prisma/client").$Enums.SubscriptionType;
        receiptData: string;
        productId: string;
        expiresAt: Date;
        adminId: string | null;
    }>;
    adminBulkGrantCredits(adminId: string, amount: number, note?: string): Promise<{
        count: number;
    }>;
    adminGetCreditGrantHistory(adminId: string, page?: number, limit?: number): Promise<{
        items: {
            admin: {
                id: string;
                name: string;
                email: string | null;
                nickname: string | null;
            } | null;
            user: {
                id: string;
                name: string;
                email: string | null;
                nickname: string | null;
                avatarUrl: string | null;
            };
            id: string;
            createdAt: Date;
            userId: string;
            type: import("@prisma/client").$Enums.CreditTxType;
            amount: number;
            referenceId: string | null;
            note: string | null;
        }[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    adminGetAllSubscriptions(adminId: string, page?: number, limit?: number): Promise<{
        items: {
            admin: {
                id: string;
                name: string;
                email: string | null;
                nickname: string | null;
            } | null;
            user: {
                id: string;
                name: string;
                email: string | null;
                nickname: string | null;
                avatarUrl: string | null;
            };
            id: string;
            createdAt: Date;
            userId: string;
            platform: import("@prisma/client").$Enums.SubscriptionPlatform;
            type: import("@prisma/client").$Enums.SubscriptionType;
            receiptData: string;
            productId: string;
            expiresAt: Date;
            adminId: string | null;
        }[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    private formatDuration;
    adminRevokeSubscription(adminId: string, userId: string): Promise<void>;
    verifyPurchase(userId: string, platform: SubscriptionPlatform, productId: string, receiptData: string): Promise<{
        isPremium: boolean;
        id: string;
        createdAt: Date;
        userId: string;
        platform: import("@prisma/client").$Enums.SubscriptionPlatform;
        type: import("@prisma/client").$Enums.SubscriptionType;
        receiptData: string;
        productId: string;
        expiresAt: Date;
        adminId: string | null;
    }>;
    private verifyAppleReceipt;
    private verifyGooglePurchase;
    private getGoogleAccessToken;
    grantSignupBonus(userId: string): Promise<void>;
    private todayKst;
}

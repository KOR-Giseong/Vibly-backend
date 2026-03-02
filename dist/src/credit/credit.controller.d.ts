import { CreditService, SubscriptionType, SubscriptionPlatform } from './credit.service';
import { AppConfigService } from '../config/app-config.service';
export declare class CreditController {
    private creditService;
    private appConfigService;
    constructor(creditService: CreditService, appConfigService: AppConfigService);
    getBalance(req: any): Promise<{
        credits: number;
        isPremium: boolean;
    }>;
    watchAd(req: any): Promise<{
        credits: number;
        earned: number;
        adWatchesToday: number;
    }>;
    getAdWatchesToday(req: any): Promise<{
        adWatchesToday: number;
        maxAdWatches: number;
    }>;
    getHistory(req: any, page?: string, limit?: string): Promise<{
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
    verifyPurchase(req: any, body: {
        platform: SubscriptionPlatform;
        productId: string;
        receiptData: string;
    }): Promise<{
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
    cancelSubscription(req: any): Promise<{
        ok: boolean;
        message: string;
    }>;
    adminGetUsers(req: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        nickname: string | null;
        avatarUrl: string | null;
        status: import("@prisma/client").$Enums.UserStatus;
        credits: number;
    }[]>;
    adminAdjust(req: any, userId: string, body: {
        amount: number;
    }): Promise<{
        credits: number;
    }>;
    adminListSubscriptions(req: any, page?: string, limit?: string): Promise<{
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
    adminGetSubscriptionHistory(req: any, page?: string, limit?: string): Promise<{
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
    adminGetCreditHistory(req: any, page?: string, limit?: string): Promise<{
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
    adminBulkGrant(req: any, body: {
        amount: number;
        note?: string;
    }): Promise<{
        count: number;
    }>;
    adminGrantSubscription(req: any, body: {
        userId: string;
        type: SubscriptionType;
        durationDays: number;
    }): Promise<{
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
    adminRevokeSubscription(req: any, userId: string): Promise<void>;
    adminGetAppConfig(req: any): Promise<Record<string, string>>;
    adminSetAppConfig(req: any, body: {
        key: string;
        value: string;
    }): Promise<{
        ok: boolean;
    }>;
}

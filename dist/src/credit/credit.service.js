"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var CreditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditService = exports.AD_DAILY_LIMIT = exports.CREDIT_REWARDS = exports.CREDIT_COSTS = exports.SubscriptionPlatform = exports.SubscriptionType = exports.CreditTxType = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const notification_service_1 = require("../notification/notification.service");
const client_1 = require("@prisma/client");
Object.defineProperty(exports, "CreditTxType", { enumerable: true, get: function () { return client_1.CreditTxType; } });
Object.defineProperty(exports, "SubscriptionPlatform", { enumerable: true, get: function () { return client_1.SubscriptionPlatform; } });
Object.defineProperty(exports, "SubscriptionType", { enumerable: true, get: function () { return client_1.SubscriptionType; } });
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
exports.CREDIT_COSTS = {
    MOOD_SEARCH_BASIC: 5,
    MOOD_SEARCH_AI: 10,
};
exports.CREDIT_REWARDS = {
    SIGNUP_BONUS: 100,
    CHECKIN_GPS: 15,
    CHECKIN_RECEIPT: 20,
    AD_WATCH: 15,
};
exports.AD_DAILY_LIMIT = 5;
let CreditService = CreditService_1 = class CreditService {
    prisma;
    notificationService;
    logger = new common_1.Logger(CreditService_1.name);
    constructor(prisma, notificationService) {
        this.prisma = prisma;
        this.notificationService = notificationService;
    }
    async getBalance(userId) {
        const [user, activeSub] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: userId },
                select: { credits: true },
            }),
            this.prisma.subscription.findFirst({
                where: { userId, expiresAt: { gt: new Date() } },
            }),
        ]);
        return { credits: user?.credits ?? 0, isPremium: !!activeSub };
    }
    async isSubscribed(userId) {
        const sub = await this.prisma.subscription.findFirst({
            where: { userId, expiresAt: { gt: new Date() } },
        });
        return !!sub;
    }
    async cancelSubscription(userId) {
        const sub = await this.prisma.subscription.findFirst({
            where: { userId, expiresAt: { gt: new Date() } },
        });
        if (!sub)
            throw new common_1.NotFoundException('활성 구독이 없어요.');
        await this.prisma.subscription.updateMany({
            where: { userId, expiresAt: { gt: new Date() } },
            data: { expiresAt: new Date() },
        });
        this.logger.log(`구독 취소 userId=${userId}`);
        return { ok: true, message: '구독이 취소되었어요.' };
    }
    async spend(userId, amount, type, referenceId) {
        const subscribed = await this.isSubscribed(userId);
        if (subscribed)
            return (await this.getBalance(userId)).credits;
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true },
        });
        if (!user)
            throw new common_1.ForbiddenException('사용자를 찾을 수 없어요.');
        if (user.credits < amount) {
            throw new common_1.BadRequestException(`크레딧이 부족해요. 필요: ${amount}, 보유: ${user.credits}`);
        }
        const [updated] = await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: userId },
                data: { credits: { decrement: amount } },
                select: { credits: true },
            }),
            this.prisma.creditTransaction.create({
                data: { userId, amount: -amount, type, referenceId },
            }),
        ]);
        this.logger.log(`크레딧 소모 [${type}] userId=${userId} -${amount} → ${updated.credits}`);
        return updated.credits;
    }
    async earn(userId, amount, type, referenceId) {
        const [updated] = await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: amount } },
                select: { credits: true },
            }),
            this.prisma.creditTransaction.create({
                data: { userId, amount: +amount, type, referenceId },
            }),
        ]);
        this.logger.log(`크레딧 획득 [${type}] userId=${userId} +${amount} → ${updated.credits}`);
        return updated.credits;
    }
    async watchAd(userId) {
        const today = this.todayKst();
        const watchCount = await this.prisma.adWatchLog.count({
            where: { userId, date: today },
        });
        if (watchCount >= exports.AD_DAILY_LIMIT) {
            throw new common_1.BadRequestException(`오늘은 더 이상 광고를 시청할 수 없어요. 내일 다시 시도해주세요. (${exports.AD_DAILY_LIMIT}회/일 제한)`);
        }
        const earned = exports.CREDIT_REWARDS.AD_WATCH;
        await this.prisma.adWatchLog.create({ data: { userId, date: today } });
        const credits = await this.earn(userId, earned, client_1.CreditTxType.AD_WATCH);
        return { credits, earned, adWatchesToday: watchCount + 1 };
    }
    async getAdWatchesToday(userId) {
        const today = this.todayKst();
        return this.prisma.adWatchLog.count({ where: { userId, date: today } });
    }
    async getHistory(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.prisma.creditTransaction.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.creditTransaction.count({ where: { userId } }),
        ]);
        return { items, total, page, hasNext: skip + items.length < total };
    }
    async adminGetUsersWithCredits(adminId) {
        await this.assertAdmin(adminId);
        return this.prisma.user.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                name: true,
                nickname: true,
                email: true,
                avatarUrl: true,
                credits: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async adminAdjustCredits(adminId, userId, amount) {
        await this.assertAdmin(adminId);
        if (amount === 0)
            throw new common_1.BadRequestException('변경량이 0입니다.');
        if (amount > 0) {
            const credits = await this.earn(userId, amount, client_1.CreditTxType.ADMIN_GRANT, adminId);
            this.notificationService
                .send(userId, 'CREDIT', '크레딧이 지급됐어요 🎁', `리워드 크레딧 ${amount}개가 지급되었어요.`, { amount, type: 'ADMIN_GRANT' })
                .catch(() => { });
            return { credits };
        }
        else {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { credits: true },
            });
            const deduct = Math.min(Math.abs(amount), user?.credits ?? 0);
            if (deduct === 0)
                return { credits: user?.credits ?? 0 };
            const [updated] = await this.prisma.$transaction([
                this.prisma.user.update({
                    where: { id: userId },
                    data: { credits: { decrement: deduct } },
                    select: { credits: true },
                }),
                this.prisma.creditTransaction.create({
                    data: {
                        userId,
                        amount: -deduct,
                        type: client_1.CreditTxType.ADMIN_GRANT,
                        referenceId: adminId,
                    },
                }),
            ]);
            return { credits: updated.credits };
        }
    }
    async assertAdmin(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { isAdmin: true },
        });
        if (!user?.isAdmin)
            throw new common_1.ForbiddenException('관리자만 접근할 수 있어요.');
    }
    async adminListSubscriptions(adminId, page = 1, limit = 30) {
        await this.assertAdmin(adminId);
        const skip = (page - 1) * limit;
        const now = new Date();
        const [items, total] = await Promise.all([
            this.prisma.subscription.findMany({
                where: { expiresAt: { gt: now } },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            nickname: true,
                            email: true,
                            avatarUrl: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.subscription.count({ where: { expiresAt: { gt: now } } }),
        ]);
        return { items, total, page, hasNext: skip + items.length < total };
    }
    async adminGrantSubscription(adminId, userId, type, durationDays) {
        await this.assertAdmin(adminId);
        const isEmail = userId.includes('@');
        const user = isEmail
            ? await this.prisma.user.findFirst({ where: { email: userId } })
            : await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('사용자를 찾을 수 없어요.');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);
        const sub = await this.prisma.subscription.create({
            data: {
                userId: user.id,
                platform: client_1.SubscriptionPlatform.WEB,
                type,
                receiptData: '',
                productId: `admin_grant_${type.toLowerCase()}`,
                expiresAt,
                adminId,
            },
            include: {
                user: { select: { id: true, name: true, nickname: true, email: true } },
            },
        });
        const durationText = this.formatDuration(durationDays);
        this.notificationService
            .send(user.id, 'CREDIT', '프리미엄 멤버십이 활성화됐어요 👑', `관리자에 의해 프리미엄 계정으로 전환되었습니다!\n${durationText}동안 프리미엄 계정으로 사용하실 수 있습니다`, {
            type: 'PREMIUM_GRANT',
            durationDays,
            expiresAt: expiresAt.toISOString(),
        })
            .catch(() => { });
        this.logger.log(`구독 부여 [ADMIN] adminId=${adminId} userId=${user.id} type=${type} durationDays=${durationDays}`);
        return sub;
    }
    async adminBulkGrantCredits(adminId, amount, note) {
        await this.assertAdmin(adminId);
        if (amount <= 0)
            throw new common_1.BadRequestException('지급 크레딧은 1 이상이어야 해요.');
        const users = await this.prisma.user.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true },
        });
        const eventNote = note?.trim() || '이벤트 크레딧 지급';
        await this.prisma.$transaction([
            this.prisma.user.updateMany({
                where: { status: 'ACTIVE', deletedAt: null },
                data: { credits: { increment: amount } },
            }),
            this.prisma.creditTransaction.createMany({
                data: users.map((u) => ({
                    userId: u.id,
                    amount,
                    type: client_1.CreditTxType.ADMIN_GRANT,
                    referenceId: adminId,
                    note: eventNote,
                })),
            }),
        ]);
        this.notificationService
            .broadcast(adminId, `크레딧이 지급됐어요 🎁`, `이벤트 보상 크레딧 ${amount}개가 지급되었어요.${note ? ` (${note})` : ''}`)
            .catch(() => { });
        this.logger.log(`전체 크레딧 지급 [ADMIN] adminId=${adminId} amount=${amount} count=${users.length} note="${eventNote}"`);
        return { count: users.length };
    }
    async adminGetCreditGrantHistory(adminId, page = 1, limit = 30) {
        await this.assertAdmin(adminId);
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.prisma.creditTransaction.findMany({
                where: { type: client_1.CreditTxType.ADMIN_GRANT },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            nickname: true,
                            email: true,
                            avatarUrl: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.creditTransaction.count({
                where: { type: client_1.CreditTxType.ADMIN_GRANT },
            }),
        ]);
        const adminIds = [
            ...new Set(items.map((i) => i.referenceId).filter(Boolean)),
        ];
        const admins = adminIds.length > 0
            ? await this.prisma.user.findMany({
                where: { id: { in: adminIds } },
                select: { id: true, name: true, nickname: true, email: true },
            })
            : [];
        const adminMap = new Map(admins.map((a) => [a.id, a]));
        return {
            items: items.map((tx) => ({
                ...tx,
                admin: tx.referenceId ? (adminMap.get(tx.referenceId) ?? null) : null,
            })),
            total,
            page,
            hasNext: skip + items.length < total,
        };
    }
    async adminGetAllSubscriptions(adminId, page = 1, limit = 30) {
        await this.assertAdmin(adminId);
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.prisma.subscription.findMany({
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            nickname: true,
                            email: true,
                            avatarUrl: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.subscription.count(),
        ]);
        const adminIds = [
            ...new Set(items.map((s) => s.adminId).filter(Boolean)),
        ];
        const admins = adminIds.length > 0
            ? await this.prisma.user.findMany({
                where: { id: { in: adminIds } },
                select: { id: true, name: true, nickname: true, email: true },
            })
            : [];
        const adminMap = new Map(admins.map((a) => [a.id, a]));
        return {
            items: items.map((sub) => ({
                ...sub,
                admin: sub.adminId ? (adminMap.get(sub.adminId) ?? null) : null,
            })),
            total,
            page,
            hasNext: skip + items.length < total,
        };
    }
    formatDuration(days) {
        if (days >= 365 && days % 365 === 0)
            return `${days / 365}년`;
        if (days >= 30 && days % 30 === 0)
            return `${days / 30}개월`;
        if (days >= 365)
            return `약 ${Math.floor(days / 365)}년`;
        if (days >= 30)
            return `약 ${Math.round(days / 30)}개월`;
        return `${days}일`;
    }
    async adminRevokeSubscription(adminId, userId) {
        await this.assertAdmin(adminId);
        const activeSub = await this.prisma.subscription.findFirst({
            where: { userId, expiresAt: { gt: new Date() } },
        });
        if (!activeSub)
            throw new common_1.NotFoundException('활성 구독이 없어요.');
        await this.prisma.subscription.update({
            where: { id: activeSub.id },
            data: { expiresAt: new Date() },
        });
        this.logger.log(`구독 취소 [ADMIN] userId=${userId}`);
    }
    async verifyPurchase(userId, platform, productId, receiptData) {
        let expiresAt;
        let verifiedProductId = productId;
        if (platform === client_1.SubscriptionPlatform.IOS) {
            const result = await this.verifyAppleReceipt(receiptData);
            expiresAt = result.expiresAt;
            verifiedProductId = result.productId;
        }
        else if (platform === client_1.SubscriptionPlatform.ANDROID) {
            const result = await this.verifyGooglePurchase(productId, receiptData);
            expiresAt = result.expiresAt;
        }
        else {
            throw new common_1.BadRequestException('웹 플랫폼은 인앱결제를 지원하지 않아요.');
        }
        const type = verifiedProductId.includes('yearly')
            ? client_1.SubscriptionType.YEARLY
            : client_1.SubscriptionType.MONTHLY;
        const sub = await this.prisma.subscription.create({
            data: {
                userId,
                platform,
                type,
                receiptData,
                productId: verifiedProductId,
                expiresAt,
            },
        });
        this.logger.log(`구독 검증 완료 [${platform}] userId=${userId} productId=${verifiedProductId} expiresAt=${expiresAt.toISOString()}`);
        return { ...sub, isPremium: true };
    }
    async verifyAppleReceipt(receiptData) {
        const sharedSecret = process.env.APPLE_SHARED_SECRET;
        if (!sharedSecret)
            throw new common_1.BadRequestException('Apple 구독 설정이 올바르지 않아요.');
        const payload = {
            'receipt-data': receiptData,
            password: sharedSecret,
            'exclude-old-transactions': true,
        };
        let resp = await axios_1.default.post('https://buy.itunes.apple.com/verifyReceipt', payload, { timeout: 10000 });
        if (resp.data.status === 21007) {
            resp = await axios_1.default.post('https://sandbox.itunes.apple.com/verifyReceipt', payload, { timeout: 10000 });
        }
        if (resp.data.status !== 0) {
            throw new common_1.BadRequestException(`Apple 영수증 검증 실패 (status: ${resp.data.status})`);
        }
        const latestInfos = resp.data.latest_receipt_info ?? [];
        if (!latestInfos.length) {
            throw new common_1.BadRequestException('유효한 구독 정보를 찾을 수 없어요.');
        }
        const latest = latestInfos.sort((a, b) => Number(b.expires_date_ms) - Number(a.expires_date_ms))[0];
        const expiresAt = new Date(Number(latest.expires_date_ms));
        if (expiresAt <= new Date()) {
            throw new common_1.BadRequestException('이미 만료된 구독 영수증이에요.');
        }
        return { expiresAt, productId: latest.product_id };
    }
    async verifyGooglePurchase(productId, purchaseToken) {
        const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
        if (!serviceAccountJson || !packageName) {
            throw new common_1.BadRequestException('Google Play 구독 설정이 올바르지 않아요.');
        }
        const serviceAccount = JSON.parse(serviceAccountJson);
        const accessToken = await this.getGoogleAccessToken(serviceAccount);
        const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
        const { data } = await axios_1.default.get(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000,
        });
        if (data.paymentState !== 1 && data.paymentState !== 2) {
            throw new common_1.BadRequestException('유효한 구독 결제 상태가 아니에요.');
        }
        const expiresAt = new Date(Number(data.expiryTimeMillis));
        if (expiresAt <= new Date()) {
            throw new common_1.BadRequestException('이미 만료된 구독이에요.');
        }
        return { expiresAt };
    }
    async getGoogleAccessToken(serviceAccount) {
        const now = Math.floor(Date.now() / 1000);
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
        const jwtPayload = Buffer.from(JSON.stringify({
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/androidpublisher',
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
        })).toString('base64url');
        const signingInput = `${header}.${jwtPayload}`;
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(signingInput);
        const signature = sign.sign(serviceAccount.private_key, 'base64url');
        const jwt = `${signingInput}.${signature}`;
        const { data } = await axios_1.default.post('https://oauth2.googleapis.com/token', new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }), { timeout: 10000 });
        return data.access_token;
    }
    async grantSignupBonus(userId) {
        await this.prisma.creditTransaction.create({
            data: {
                userId,
                amount: exports.CREDIT_REWARDS.SIGNUP_BONUS,
                type: client_1.CreditTxType.SIGNUP_BONUS,
            },
        });
    }
    todayKst() {
        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        return kst.toISOString().slice(0, 10);
    }
};
exports.CreditService = CreditService;
exports.CreditService = CreditService = CreditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService])
], CreditService);
//# sourceMappingURL=credit.service.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const expo_server_sdk_1 = __importDefault(require("expo-server-sdk"));
const expo = new expo_server_sdk_1.default();
let NotificationService = NotificationService_1 = class NotificationService {
    prisma;
    logger = new common_1.Logger(NotificationService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async registerToken(userId, pushToken, platform) {
        if (!expo_server_sdk_1.default.isExpoPushToken(pushToken)) {
            this.logger.warn(`Invalid Expo push token for user=${userId}`);
            return;
        }
        await this.prisma.device.upsert({
            where: { pushToken },
            create: { userId, pushToken, platform },
            update: { userId, platform },
        });
    }
    async removeToken(userId, pushToken) {
        if (pushToken) {
            await this.prisma.device
                .deleteMany({ where: { userId, pushToken } })
                .catch(() => { });
        }
        else {
            await this.prisma.device
                .deleteMany({ where: { userId } })
                .catch(() => { });
        }
    }
    async send(userId, type, title, body, payload) {
        const notifData = {
            user: { connect: { id: userId } },
            type,
            title,
            body,
            payload: (payload ?? {}),
        };
        await this.prisma.notification
            .create({ data: notifData })
            .catch((e) => this.logger.error(`notification insert failed: ${String(e)}`));
        const devices = await this.prisma.device
            .findMany({ where: { userId }, select: { pushToken: true } })
            .catch(() => []);
        if (!devices.length)
            return;
        const messages = devices
            .filter((d) => expo_server_sdk_1.default.isExpoPushToken(d.pushToken))
            .map((d) => ({
            to: d.pushToken,
            sound: 'default',
            title,
            body,
            data: (payload ?? {}),
            badge: 1,
            channelId: 'default',
        }));
        if (!messages.length)
            return;
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            expo
                .sendPushNotificationsAsync(chunk)
                .catch((e) => this.logger.error(`Expo push send failed: ${String(e)}`));
        }
    }
    async getList(userId, page = 1, limit = 30) {
        const skip = (page - 1) * limit;
        const [items, total, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where: { userId } }),
            this.prisma.notification.count({ where: { userId, isRead: false } }),
        ]);
        return {
            items,
            total,
            unreadCount,
            page,
            hasNext: skip + items.length < total,
        };
    }
    async getUnreadCount(userId) {
        return this.prisma.notification.count({ where: { userId, isRead: false } });
    }
    async markRead(id, userId) {
        await this.prisma.notification
            .updateMany({ where: { id, userId }, data: { isRead: true } })
            .catch(() => { });
    }
    async markAllRead(userId) {
        await this.prisma.notification
            .updateMany({ where: { userId, isRead: false }, data: { isRead: true } })
            .catch(() => { });
    }
    async deleteOne(id, userId) {
        await this.prisma.notification
            .deleteMany({ where: { id, userId } })
            .catch(() => { });
    }
    async broadcast(adminId, title, body, type = 'PROMO') {
        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
            select: { isAdmin: true },
        });
        if (!admin?.isAdmin)
            throw new Error('관리자만 전송할 수 있어요.');
        const users = await this.prisma.user.findMany({
            where: { deletedAt: null, status: 'ACTIVE' },
            select: { id: true },
        });
        await this.prisma.notification.createMany({
            data: users.map((u) => ({
                userId: u.id,
                type,
                title,
                body,
                payload: {},
            })),
            skipDuplicates: true,
        });
        const devices = await this.prisma.device.findMany({
            select: { pushToken: true },
        });
        const messages = devices
            .filter((d) => expo_server_sdk_1.default.isExpoPushToken(d.pushToken))
            .map((d) => ({
            to: d.pushToken,
            sound: 'default',
            title,
            body,
            data: {},
            badge: 1,
            channelId: 'default',
        }));
        if (messages.length) {
            const chunks = expo.chunkPushNotifications(messages);
            for (const chunk of chunks) {
                expo
                    .sendPushNotificationsAsync(chunk)
                    .catch((e) => this.logger.error(`broadcast push failed: ${String(e)}`));
            }
        }
        return { sent: users.length };
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map
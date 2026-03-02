import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, Prisma } from '@prisma/client';
export declare class NotificationService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    registerToken(userId: string, pushToken: string, platform: string): Promise<void>;
    removeToken(userId: string, pushToken?: string): Promise<void>;
    send(userId: string, type: NotificationType, title: string, body: string, payload?: Record<string, unknown>): Promise<void>;
    getList(userId: string, page?: number, limit?: number): Promise<{
        items: {
            id: string;
            createdAt: Date;
            userId: string;
            type: import("@prisma/client").$Enums.NotificationType;
            title: string;
            body: string;
            isRead: boolean;
            payload: Prisma.JsonValue | null;
        }[];
        total: number;
        unreadCount: number;
        page: number;
        hasNext: boolean;
    }>;
    getUnreadCount(userId: string): Promise<number>;
    markRead(id: string, userId: string): Promise<void>;
    markAllRead(userId: string): Promise<void>;
    deleteOne(id: string, userId: string): Promise<void>;
    broadcast(adminId: string, title: string, body: string, type?: NotificationType): Promise<{
        sent: number;
    }>;
}

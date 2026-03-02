import { NotificationService } from './notification.service';
import { RegisterTokenDto } from './dto/register-token.dto';
export declare class NotificationController {
    private readonly notificationService;
    constructor(notificationService: NotificationService);
    registerToken(req: {
        user: {
            id: string;
        };
    }, dto: RegisterTokenDto): Promise<void>;
    getList(req: {
        user: {
            id: string;
        };
    }, page: number, limit: number): Promise<{
        items: {
            id: string;
            createdAt: Date;
            userId: string;
            type: import("@prisma/client").$Enums.NotificationType;
            title: string;
            body: string;
            isRead: boolean;
            payload: import("@prisma/client/runtime/client").JsonValue | null;
        }[];
        total: number;
        unreadCount: number;
        page: number;
        hasNext: boolean;
    }>;
    getUnreadCount(req: {
        user: {
            id: string;
        };
    }): Promise<{
        count: number;
    }>;
    markAllRead(req: {
        user: {
            id: string;
        };
    }): Promise<void>;
    markRead(req: {
        user: {
            id: string;
        };
    }, id: string): Promise<void>;
    deleteOne(req: {
        user: {
            id: string;
        };
    }, id: string): Promise<void>;
    removeToken(req: {
        user: {
            id: string;
        };
    }, pushToken?: string): Promise<void>;
    broadcast(req: {
        user: {
            id: string;
        };
    }, body: {
        title: string;
        message: string;
    }): Promise<{
        sent: number;
    }>;
}

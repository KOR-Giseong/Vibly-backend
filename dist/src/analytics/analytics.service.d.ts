import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '@prisma/client';
export declare class AnalyticsService {
    private prisma;
    constructor(prisma: PrismaService);
    trackEvents(userId: string | undefined, events: Array<{
        type: EventType;
        payload?: any;
    }>): Promise<import("@prisma/client").Prisma.BatchPayload>;
}

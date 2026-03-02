import { AnalyticsService } from './analytics.service';
import { EventType } from '@prisma/client';
export declare class AnalyticsController {
    private analyticsService;
    constructor(analyticsService: AnalyticsService);
    track(req: any, body: {
        events: Array<{
            type: EventType;
            payload?: any;
        }>;
    }): Promise<import("@prisma/client").Prisma.BatchPayload>;
}

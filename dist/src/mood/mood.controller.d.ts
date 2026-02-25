import { MoodService } from './mood.service';
import { MoodSearchDto } from './dto/mood-search.dto';
export declare class MoodController {
    private moodService;
    constructor(moodService: MoodService);
    search(req: any, body: MoodSearchDto): Promise<{
        summary: string;
        places: import("../place/types/kakao.types").Place[];
        keywords: string[];
        query: string;
        fallback: boolean;
    }>;
    vibeReport(req: any, period: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        summary: import("@prisma/client/runtime/client").JsonValue;
        period: string;
    }>;
}

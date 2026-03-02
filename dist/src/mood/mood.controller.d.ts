import { MoodService } from './mood.service';
import { MoodSearchDto } from './dto/mood-search.dto';
import { CreditService } from '../credit/credit.service';
export declare class MoodController {
    private moodService;
    private creditService;
    constructor(moodService: MoodService, creditService: CreditService);
    search(req: any, body: MoodSearchDto): Promise<{
        creditCost: 5 | 10;
        remainingCredits: number | undefined;
        summary: string;
        places: any[];
        keywords: string[];
        query: string;
        fallback: boolean;
    }>;
    vibeReport(req: any, period: string): Promise<{
        period: string;
        dateRange: string;
        checkInCount: number;
        uniquePlacesCount: number;
        reviewCount: number;
        vibeScore: number;
        emotionDistribution: {
            mood: string;
            label: string;
            emoji: string;
            color: string;
            count: number;
            percentage: number;
        }[];
        dailyMoods: {
            date: string;
            dayLabel: string;
            mood: string | null;
            emoji: string | null;
            checkInCount: number;
        }[];
        topCategories: {
            category: string;
            label: string;
            color: string;
            count: number;
            percentage: number;
        }[];
        insights: {
            emoji: string;
            title: string;
            desc: string;
        }[];
    }>;
}

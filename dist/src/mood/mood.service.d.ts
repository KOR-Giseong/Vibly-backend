import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from '../place/kakao.service';
import { GooglePlacesService } from '../place/google-places.service';
import { PlaceService } from '../place/place.service';
import { CreditService } from '../credit/credit.service';
export declare class MoodService {
    private prisma;
    private config;
    private kakao;
    private googlePlaces;
    private placeService;
    private creditService;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, kakao: KakaoService, googlePlaces: GooglePlacesService, placeService: PlaceService, creditService: CreditService);
    search(query: string, userId?: string, lat?: number, lng?: number, limit?: number, radius?: number): Promise<{
        summary: string;
        places: any[];
        keywords: string[];
        query: string;
        wasAiSearch: boolean;
        fallback: boolean;
    }>;
    private analyzeWithGemini;
    private searchKakaoPlaces;
    private rankByMoodRelevance;
    private tryQuickMatch;
    private buildFallbackAnalysis;
    private saveMoodSearchLog;
    getVibeReport(userId: string, period: string): Promise<{
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

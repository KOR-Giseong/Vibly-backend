import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from '../place/kakao.service';
import { GooglePlacesService } from '../place/google-places.service';
export declare class MoodService {
    private prisma;
    private config;
    private kakao;
    private googlePlaces;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, kakao: KakaoService, googlePlaces: GooglePlacesService);
    search(query: string, userId?: string, lat?: number, lng?: number): Promise<{
        summary: string;
        places: import("../place/types/kakao.types").Place[];
        keywords: string[];
        query: string;
        fallback: boolean;
    }>;
    private analyzeWithGemini;
    private searchKakaoPlaces;
    private tryQuickMatch;
    private buildFallbackAnalysis;
    private saveMoodSearchLog;
    getVibeReport(userId: string, period: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        summary: import("@prisma/client/runtime/client").JsonValue;
        period: string;
    }>;
}

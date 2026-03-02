import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from './kakao.service';
import { GooglePlacesService } from './google-places.service';
import type { Place } from './types/kakao.types';
import { OcrService } from '../ocr/ocr.service';
import { ReceiptMatcherService } from '../ocr/receipt-matcher.service';
import { CreditService } from '../credit/credit.service';
import { NotificationService } from '../notification/notification.service';
export interface AIReason {
    icon: string;
    title: string;
    description: string;
}
export declare class PlaceService {
    private prisma;
    private kakao;
    private googlePlaces;
    private config;
    private ocr;
    private receiptMatcher;
    private creditService;
    private notificationService;
    private readonly logger;
    constructor(prisma: PrismaService, kakao: KakaoService, googlePlaces: GooglePlacesService, config: ConfigService, ocr: OcrService, receiptMatcher: ReceiptMatcherService, creditService: CreditService, notificationService: NotificationService);
    getNearby(lat: number, lng: number, radiusM?: number, page?: number, limit?: number): Promise<{
        data: Place[];
        page: number;
        total: number;
        hasNext: boolean;
    } | {
        data: ({
            tags: {
                id: string;
                placeId: string;
                tag: string;
            }[];
            images: {
                url: string;
                id: string;
                createdAt: Date;
                isPrimary: boolean;
                placeId: string;
            }[];
        } & {
            id: string;
            name: string;
            category: import("@prisma/client").$Enums.PlaceCategory;
            description: string | null;
            address: string;
            lat: number;
            lng: number;
            phone: string | null;
            hours: string | null;
            rating: number;
            reviewCount: number;
            vibeScore: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        })[];
        page: number;
        hasNext: boolean;
        total?: undefined;
    }>;
    search(query: string, lat?: number, lng?: number, page?: number, limit?: number): Promise<{
        data: Place[];
        page: number;
        total: number;
        hasNext: boolean;
    } | {
        data: ({
            tags: {
                id: string;
                placeId: string;
                tag: string;
            }[];
            images: {
                url: string;
                id: string;
                createdAt: Date;
                isPrimary: boolean;
                placeId: string;
            }[];
        } & {
            id: string;
            name: string;
            category: import("@prisma/client").$Enums.PlaceCategory;
            description: string | null;
            address: string;
            lat: number;
            lng: number;
            phone: string | null;
            hours: string | null;
            rating: number;
            reviewCount: number;
            vibeScore: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        })[];
        page: number;
        hasNext: boolean;
        total?: undefined;
    }>;
    getById(id: string, userId?: string, hint?: {
        name: string;
        lat: number;
        lng: number;
    }, mood?: string, vibes?: string[]): Promise<{
        vibeScore: number;
        tags: string[];
        description: string;
        imageUrl: string;
        rating: number;
        reviewCount: number;
        googleRating: number | undefined;
        googleReviewCount: number | undefined;
        emotionMatch: {
            label: string;
            value: number;
        }[];
        aiReasons: AIReason[];
        isBookmarked: boolean;
        myCheckInCount: number;
        myReview: ({
            user: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            rating: number;
            createdAt: Date;
            userId: string;
            body: string;
            placeId: string;
        }) | null;
        reviews: {
            id: any;
            user: any;
            rating: any;
            body: any;
            createdAt: any;
            likesCount: any;
            isLiked: boolean;
        }[];
        images: {
            url: string;
            id: string;
            createdAt: Date;
            isPrimary: boolean;
            placeId: string;
        }[];
        id: string;
        name: string;
        category: import("@prisma/client").$Enums.PlaceCategory;
        address: string;
        lat: number;
        lng: number;
        phone: string | null;
        hours: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    toggleBookmark(userId: string, placeId: string, imageUrl?: string): Promise<{
        isBookmarked: boolean;
    }>;
    private refreshGooglePhotoUrl;
    getBookmarks(userId: string): Promise<{
        id: string;
        name: string;
        category: import("@prisma/client").$Enums.PlaceCategory;
        categoryLabel: string;
        address: string;
        lat: number;
        lng: number;
        rating: number;
        reviewCount: number;
        imageUrl: string;
        tags: string[];
        isBookmarked: boolean;
        savedAt: Date;
    }[]>;
    private toCategoryLabel;
    addReview(userId: string, placeId: string, rating: number, body: string): Promise<{
        user: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        rating: number;
        createdAt: Date;
        userId: string;
        body: string;
        placeId: string;
    }>;
    getReviews(placeId: string, page?: number, limit?: number, userId?: string): Promise<{
        reviews: {
            id: any;
            user: any;
            rating: any;
            body: any;
            createdAt: any;
            likesCount: any;
            isLiked: boolean;
        }[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    likeReview(userId: string, reviewId: string): Promise<{
        likesCount: number;
    }>;
    unlikeReview(userId: string, reviewId: string): Promise<{
        likesCount: number;
    }>;
    checkInWithReceipt(userId: string, placeId: string, receiptBuffer: Buffer | null, mood: string, note?: string, lat?: number, lng?: number): Promise<{
        creditEarned: 15 | 20;
        id: string;
        createdAt: Date;
        userId: string;
        note: string | null;
        imageUrl: string | null;
        placeId: string;
        mood: string;
        receiptVerified: boolean;
        receiptHash: string | null;
    }>;
    private haversineDistance;
    checkIn(userId: string, placeId: string, mood: string, note?: string, imageUrl?: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        note: string | null;
        imageUrl: string | null;
        placeId: string;
        mood: string;
        receiptVerified: boolean;
        receiptHash: string | null;
    }>;
    getMyCheckins(userId: string): Promise<{
        id: string;
        placeId: string;
        placeName: string;
        category: import("@prisma/client").$Enums.PlaceCategory;
        address: string;
        imageUrl: string;
        mood: string;
        note: string | null;
        imageUrl_checkin: string | null;
        createdAt: Date;
    }[]>;
    upsertKakaoPlaces(places: Place[]): Promise<void>;
    private readonly VALID_CATEGORIES;
    private toValidCategory;
    private upsertKakaoPlace;
    private fetchKakaoPlaceById;
    mergeDbRatings(places: Place[]): Promise<Place[]>;
    private categoryVibeScore;
    private personalizeByMood;
    private personalizeByVibes;
    private generateVibeTags;
    private generateDescription;
    private generateAiReasons;
    smartRecommend(userId: string, lat: number, lng: number, mode?: 'nearby' | 'wide'): Promise<{
        message: string;
        weather: string;
        timeOfDay: string;
        keywords: string[];
        places: Place[];
        mode: "nearby" | "wide";
    }>;
    getReviewSummary(placeId: string, userId: string): Promise<{
        reviewCount: number;
        targetAudience: string | null;
        placeId: string;
        summary: string;
        pros: string[];
        cons: string[];
        generatedAt: Date;
    }>;
}

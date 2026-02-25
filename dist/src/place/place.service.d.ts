import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from './kakao.service';
import { GooglePlacesService } from './google-places.service';
import type { Place } from './types/kakao.types';
export interface AIReason {
    icon: string;
    title: string;
    description: string;
}
export declare class PlaceService {
    private prisma;
    private kakao;
    private googlePlaces;
    private readonly logger;
    constructor(prisma: PrismaService, kakao: KakaoService, googlePlaces: GooglePlacesService);
    getNearby(lat: number, lng: number, radiusKm?: number, page?: number): Promise<{
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
                id: string;
                createdAt: Date;
                isPrimary: boolean;
                placeId: string;
                url: string;
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
    }>;
    search(query: string, lat?: number, lng?: number, page?: number): Promise<{
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
                id: string;
                createdAt: Date;
                isPrimary: boolean;
                placeId: string;
                url: string;
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
    }>;
    getById(id: string, userId?: string): Promise<{
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
            placeId: string;
            userId: string;
            body: string;
        }) | null;
        images: {
            id: string;
            createdAt: Date;
            isPrimary: boolean;
            placeId: string;
            url: string;
        }[];
        reviews: ({
            user: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            rating: number;
            createdAt: Date;
            placeId: string;
            userId: string;
            body: string;
        })[];
        id: string;
        name: string;
        category: import("@prisma/client").$Enums.PlaceCategory;
        address: string;
        lat: number;
        lng: number;
        phone: string | null;
        hours: string | null;
        vibeScore: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    toggleBookmark(userId: string, placeId: string): Promise<{
        bookmarked: boolean;
    }>;
    getBookmarks(userId: string): Promise<({
        place: {
            tags: {
                id: string;
                placeId: string;
                tag: string;
            }[];
            images: {
                id: string;
                createdAt: Date;
                isPrimary: boolean;
                placeId: string;
                url: string;
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
        };
    } & {
        id: string;
        createdAt: Date;
        placeId: string;
        userId: string;
    })[]>;
    addReview(userId: string, placeId: string, rating: number, body: string): Promise<{
        user: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        rating: number;
        createdAt: Date;
        placeId: string;
        userId: string;
        body: string;
    }>;
    getReviews(placeId: string, page?: number, limit?: number): Promise<{
        reviews: ({
            user: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            rating: number;
            createdAt: Date;
            placeId: string;
            userId: string;
            body: string;
        })[];
        total: number;
        page: number;
        hasNext: boolean;
    }>;
    checkIn(userId: string, placeId: string, mood: string, note?: string, imageUrl?: string): Promise<{
        id: string;
        createdAt: Date;
        placeId: string;
        userId: string;
        mood: string;
        note: string | null;
        imageUrl: string | null;
    }>;
    upsertKakaoPlaces(places: Place[]): Promise<void>;
    private readonly VALID_CATEGORIES;
    private toValidCategory;
    private upsertKakaoPlace;
    private fetchKakaoPlaceById;
    mergeDbRatings(places: Place[]): Promise<Place[]>;
    private paginateKakao;
    private generateVibeTags;
    private generateDescription;
    private generateAiReasons;
}

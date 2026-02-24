import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from './kakao.service';
import type { Place } from './types/kakao.types';
export declare class PlaceService {
    private prisma;
    private kakao;
    private readonly logger;
    constructor(prisma: PrismaService, kakao: KakaoService);
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
                url: string;
                id: string;
                createdAt: Date;
                isPrimary: boolean;
                placeId: string;
            }[];
        } & {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            hours: string | null;
            category: import("@prisma/client").$Enums.PlaceCategory;
            description: string | null;
            address: string;
            lat: number;
            lng: number;
            phone: string | null;
            rating: number;
            reviewCount: number;
            vibeScore: number;
            isActive: boolean;
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
                url: string;
                id: string;
                createdAt: Date;
                isPrimary: boolean;
                placeId: string;
            }[];
        } & {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            hours: string | null;
            category: import("@prisma/client").$Enums.PlaceCategory;
            description: string | null;
            address: string;
            lat: number;
            lng: number;
            phone: string | null;
            rating: number;
            reviewCount: number;
            vibeScore: number;
            isActive: boolean;
        })[];
        page: number;
        hasNext: boolean;
    }>;
    getById(id: string): Promise<{
        reviews: ({
            user: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            rating: number;
            placeId: string;
            body: string;
        })[];
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
        createdAt: Date;
        updatedAt: Date;
        hours: string | null;
        category: import("@prisma/client").$Enums.PlaceCategory;
        description: string | null;
        address: string;
        lat: number;
        lng: number;
        phone: string | null;
        rating: number;
        reviewCount: number;
        vibeScore: number;
        isActive: boolean;
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
                url: string;
                id: string;
                createdAt: Date;
                isPrimary: boolean;
                placeId: string;
            }[];
        } & {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            hours: string | null;
            category: import("@prisma/client").$Enums.PlaceCategory;
            description: string | null;
            address: string;
            lat: number;
            lng: number;
            phone: string | null;
            rating: number;
            reviewCount: number;
            vibeScore: number;
            isActive: boolean;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        placeId: string;
    })[]>;
    checkIn(userId: string, placeId: string, mood: string, note?: string, imageUrl?: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        placeId: string;
        mood: string;
        note: string | null;
        imageUrl: string | null;
    }>;
    upsertKakaoPlaces(places: Place[]): Promise<void>;
    private upsertKakaoPlace;
    private fetchKakaoPlaceById;
    private paginateKakao;
}

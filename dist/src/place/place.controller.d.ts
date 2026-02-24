import { PlaceService } from './place.service';
export declare class PlaceController {
    private placeService;
    constructor(placeService: PlaceService);
    nearby(lat: string, lng: string, radius?: string, page?: string): Promise<{
        data: import("./types/kakao.types").Place[];
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
    search(q: string, lat?: string, lng?: string, page?: string): Promise<{
        data: import("./types/kakao.types").Place[];
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
    getBookmarks(req: any): Promise<({
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
    bookmark(req: any, id: string): Promise<{
        bookmarked: boolean;
    }>;
    checkIn(req: any, id: string, body: {
        mood: string;
        note?: string;
        imageUrl?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        placeId: string;
        mood: string;
        note: string | null;
        imageUrl: string | null;
    }>;
}

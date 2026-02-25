import { PlaceService } from './place.service';
import { CheckInDto } from './dto/checkin.dto';
import { AddReviewDto } from './dto/add-review.dto';
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
    getBookmarks(req: any): Promise<({
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
    getById(req: any, id: string): Promise<{
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
        aiReasons: import("./place.service").AIReason[];
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
    bookmark(req: any, id: string): Promise<{
        bookmarked: boolean;
    }>;
    checkIn(req: any, id: string, body: CheckInDto): Promise<{
        id: string;
        createdAt: Date;
        placeId: string;
        userId: string;
        mood: string;
        note: string | null;
        imageUrl: string | null;
    }>;
    getReviews(id: string, page?: string, limit?: string): Promise<{
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
    addReview(req: any, id: string, body: AddReviewDto): Promise<{
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
}

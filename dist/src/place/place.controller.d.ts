import { PlaceService } from './place.service';
import { CheckInDto } from './dto/checkin.dto';
import { AddReviewDto } from './dto/add-review.dto';
export declare class PlaceController {
    private placeService;
    constructor(placeService: PlaceService);
    nearby(lat: string, lng: string, radius?: string, limit?: string, page?: string): Promise<{
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
    search(query: string, q: string, lat?: string, lng?: string, limit?: string, page?: string): Promise<{
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
    getBookmarks(req: any): Promise<{
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
    getMyCheckins(req: any): Promise<{
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
    getById(req: any, id: string, name?: string, lat?: string, lng?: string, mood?: string, vibes?: string): Promise<{
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
        aiReasons: import("./place.service").AIReason[];
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
    bookmark(req: any, id: string, body: {
        imageUrl?: string;
    }): Promise<{
        isBookmarked: boolean;
    }>;
    checkIn(req: any, id: string, body: CheckInDto, receipt?: Express.Multer.File): Promise<{
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
    getReviews(req: any, id: string, page?: string, limit?: string): Promise<{
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
    addReview(req: any, id: string, body: AddReviewDto): Promise<{
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
    likeReview(req: any, _placeId: string, reviewId: string): Promise<{
        likesCount: number;
    }>;
    unlikeReview(req: any, _placeId: string, reviewId: string): Promise<{
        likesCount: number;
    }>;
    getReviewSummary(req: any, id: string): Promise<{
        reviewCount: number;
        targetAudience: string | null;
        placeId: string;
        summary: string;
        pros: string[];
        cons: string[];
        generatedAt: Date;
    }>;
    smartRecommend(req: any, body: {
        lat: number;
        lng: number;
        mode?: 'nearby' | 'wide';
    }): Promise<{
        message: string;
        weather: string;
        timeOfDay: string;
        keywords: string[];
        places: import("./types/kakao.types").Place[];
        mode: "nearby" | "wide";
    }>;
}

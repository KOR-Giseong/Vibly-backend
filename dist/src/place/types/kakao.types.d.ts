export interface Place {
    id: string;
    name: string;
    category: string;
    categoryLabel: string;
    address: string;
    lat: number;
    lng: number;
    phone?: string;
    hours?: string;
    description?: string;
    placeUrl?: string;
    rating: number;
    reviewCount: number;
    tags: string[];
    distance?: string;
    imageUrl?: string;
    vibeScore?: number;
    isSponsored?: boolean;
    isBookmarked?: boolean;
    googleRating?: number;
    googleReviewCount?: number;
}

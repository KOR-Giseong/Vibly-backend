// 백엔드 내부 장소 표현 (카카오 → 프론트 공통)
// category는 'CAFE' | 'RESTAURANT' | 'BAR' | 'PARK' | 'CULTURAL' | 'BOOKSTORE' | 'ETC'
export interface Place {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;   // 한글 카테고리 ("카페", "레스토랑" ...)
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
  // Google Places 보완 데이터 (Vibly 데이터와 분리)
  googleRating?: number;
  googleReviewCount?: number;
}

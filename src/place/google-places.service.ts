import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Place } from './types/kakao.types';

interface GooglePlace {
  id: string;
  rating?: number;
  userRatingCount?: number;
  photos?: { name: string }[];
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  editorialSummary?: { text?: string };
}

interface GoogleTextSearchResponse {
  places?: GooglePlace[];
}

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly baseUrl = 'https://places.googleapis.com/v1';

  constructor(private config: ConfigService) {}

  private get apiKey(): string {
    return this.config.get<string>('GOOGLE_PLACES_API_KEY') ?? '';
  }

  /**
   * 카카오 검색 결과 목록에 Google Places 사진 + 평점 + 영업시간 + 소개를 보완합니다.
   * 실패해도 원본 place를 그대로 반환합니다.
   */
  async enrichPlaces(places: Place[]): Promise<Place[]> {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY 없음 → 보완 생략');
      return places;
    }

    const enriched = await Promise.all(
      places.map((place) => this.enrichOne(place)),
    );
    return enriched;
  }

  private async enrichOne(place: Place): Promise<Place> {
    try {
      const query = `${place.name} ${place.address}`;
      const result = await this.textSearch(query);
      if (!result) return place;

      const photoUrl = result.photos?.[0]
        ? this.buildPhotoUrl(result.photos[0].name)
        : undefined;

      // 영업시간: "월요일: 오전 9:00 ~ 오후 10:00" → "오전 9:00 ~ 오후 10:00"
      const weekday = result.regularOpeningHours?.weekdayDescriptions?.[0];
      const hours = weekday?.replace(/^[가-힣]+요일:\s*/, '');

      return {
        ...place,
        imageUrl: photoUrl ?? place.imageUrl,
        // Vibly rating은 건드리지 않음 → googleRating / googleReviewCount으로 분리
        googleRating: result.rating ?? place.googleRating,
        googleReviewCount: result.userRatingCount ?? place.googleReviewCount,
        hours: hours ?? place.hours,
        description: result.editorialSummary?.text ?? place.description,
      };
    } catch (err) {
      this.logger.warn(`Google 보완 실패: ${place.name}`, err);
      return place;
    }
  }

  private async textSearch(query: string): Promise<GooglePlace | null> {
    const res = await fetch(`${this.baseUrl}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask':
          'places.id,places.rating,places.userRatingCount,places.photos,places.regularOpeningHours,places.editorialSummary',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'ko',
        maxResultCount: 1,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      this.logger.warn(`Google Text Search 오류: ${res.status} ${res.statusText} | ${errBody.slice(0, 300)}`);
      return null;
    }

    const data = (await res.json()) as GoogleTextSearchResponse;
    return data.places?.[0] ?? null;
  }

  /** Google Places 사진 URL 생성 */
  private buildPhotoUrl(photoName: string): string {
    return `${this.baseUrl}/${photoName}/media?maxWidthPx=400&key=${this.apiKey}`;
  }

  /**
   * 단일 장소의 Google 데이터 (평점·리뷰수·사진) 조회.
   * place detail 화면에서 사용.
   */
  async getGoogleData(name: string, address: string): Promise<{
    googleRating?: number;
    googleReviewCount?: number;
    imageUrl?: string;
  } | null> {
    if (!this.apiKey) return null;
    try {
      const result = await this.textSearch(`${name} ${address}`);
      if (!result) return null;
      return {
        googleRating: result.rating,
        googleReviewCount: result.userRatingCount,
        imageUrl: result.photos?.[0] ? this.buildPhotoUrl(result.photos[0].name) : undefined,
      };
    } catch {
      return null;
    }
  }
}

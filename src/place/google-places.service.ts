import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Place } from './types/kakao.types';

interface GooglePlace {
  id: string;
  rating?: number;
  userRatingCount?: number;
  photos?: { name: string }[];
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
   * 카카오 검색 결과 목록에 Google Places 사진 + 평점을 보완합니다.
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

      return {
        ...place,
        imageUrl: photoUrl ?? place.imageUrl,
        rating: result.rating ?? place.rating,
        reviewCount: result.userRatingCount ?? place.reviewCount,
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
          'places.id,places.rating,places.userRatingCount,places.photos',
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
}

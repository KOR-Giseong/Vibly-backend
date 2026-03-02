import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Place } from './types/kakao.types';

// 카카오 카테고리 코드 → 우리 카테고리 매핑
const CATEGORY_MAP: Record<string, string> = {
  CE7: 'CAFE',
  FD6: 'RESTAURANT',
  OL7: 'BAR',
  AT4: 'PARK',
  CT1: 'CULTURAL',
  BK9: 'BOOKSTORE',
};

const CATEGORY_LABEL: Record<string, string> = {
  CAFE: '카페',
  RESTAURANT: '레스토랑',
  BAR: '바',
  PARK: '공원',
  CULTURAL: '문화공간',
  BOOKSTORE: '서점',
  BOWLING: '볼링장',
  KARAOKE: '노래방',
  SPA: '찜질방/스파',
  ESCAPE: '방탈출',
  ARCADE: '오락실',
  ETC: '기타',
};

// 카카오 카테고리별 Unsplash 대표 이미지 (고정 ID → 항상 같은 사진)
const CATEGORY_IMAGE: Record<string, string> = {
  CAFE: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80',
  RESTAURANT:
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
  BAR: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=400&q=80',
  PARK: 'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=400&q=80',
  CULTURAL:
    'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80',
  BOOKSTORE:
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80',
  BOWLING:
    'https://images.unsplash.com/photo-1567522838345-7e91be72fb0e?w=400&q=80',
  KARAOKE:
    'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&q=80',
  SPA: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80',
  ESCAPE:
    'https://images.unsplash.com/photo-1559181567-c3190e52d8e4?w=400&q=80',
  ARCADE:
    'https://images.unsplash.com/photo-1511882150382-421056c89033?w=400&q=80',
  ETC: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&q=80',
};

// 카카오 장소 응답 원본 타입
interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string; // lng
  y: string; // lat
  place_url: string;
  distance?: string; // 미터 단위 문자열
}

interface KakaoSearchResponse {
  documents: KakaoPlace[];
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
}

@Injectable()
export class KakaoService {
  private readonly logger = new Logger(KakaoService.name);
  private readonly baseUrl = 'https://dapi.kakao.com/v2/local/search';
  private readonly apiKey: string;

  constructor(private config: ConfigService) {
    this.apiKey = config.get<string>('KAKAO_REST_API_KEY') ?? '';
  }

  // ── native fetch helper (ERR_CANCELED 없음) ─────────────────────────────────
  private async kakaoFetch<T>(path: string, params: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${this.apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Kakao API ${res.status}`);
    return res.json() as Promise<T>;
  }

  // ── 키워드 검색 ─────────────────────────────────────────────────────────────
  async searchByKeyword(
    query: string,
    lat?: number,
    lng?: number,
    page = 1,
    sort: 'accuracy' | 'distance' = 'distance',
    limit = 15,
    radiusM?: number,
  ): Promise<Place[]> {
    try {
      const params: Record<string, unknown> = {
        query,
        page,
        size: Math.min(15, Math.max(1, limit)), // 카카오 keyword API 최대 15
      };
      if (lat != null && lng != null) {
        params.x = lng;
        params.y = lat;
        params.sort = sort;
        if (radiusM != null) params.radius = radiusM;
      }

      const data = await this.kakaoFetch<KakaoSearchResponse>('/keyword.json', params);
      return data.documents.slice(0, limit).map((doc) => this.toPlace(doc));
    } catch (err) {
      this.logger.error('카카오 키워드 검색 실패', err);
      return [];
    }
  }

  // ── 반경 내 카테고리 검색 (카테고리별 병렬 호출 후 인터리빙 병합) ──────────
  async searchNearby(
    lat: number,
    lng: number,
    radiusM = 2000,
    page = 1,
    limit = 20,
  ): Promise<Place[]> {
    // 카테고리 6개 + 키워드 5개에 걸쳐 limit을 고르게 분배
    const categoryCodes = ['CE7', 'FD6', 'AT4', 'CT1', 'BK9', 'OL7'];
    const keywords = ['볼링장', '노래방', '찜질방', '방탈출', '오락실'];
    // 각 카테고리/키워드당 최소 1~최대 15개 (카카오 category API 제한)
    const catSize = Math.min(15, Math.max(1, Math.ceil(limit / categoryCodes.length) + 1));
    const kwSize  = Math.min(15, Math.max(1, Math.ceil(limit / keywords.length)));

    // ① 카카오 카테고리 코드가 있는 장소 → category.json API
    const categoryResults = await Promise.allSettled(
      categoryCodes.map((code) =>
        this.kakaoFetch<KakaoSearchResponse>('/category.json', {
          category_group_code: code,
          x: lng,
          y: lat,
          radius: radiusM,
          sort: 'distance',
          size: catSize,
          page,
        }).then((data) => data.documents.map((doc) => this.toPlace(doc))),
      ),
    );

    // ② 카카오 카테고리 코드가 없는 장소 → keyword.json API (위치 기반)
    const keywordResults = await Promise.allSettled(
      keywords.map((query) =>
        this.kakaoFetch<KakaoSearchResponse>('/keyword.json', {
          query,
          x: lng,
          y: lat,
          radius: radiusM,
          sort: 'distance',
          size: kwSize,
          page,
        }).then((data) => data.documents.map((doc) => this.toPlace(doc))),
      ),
    );

    // ③ 두 결과 합쳐서 인터리빙 병합 (limit 개수만큼)
    const sets = [...categoryResults, ...keywordResults]
      .filter((r): r is PromiseFulfilledResult<Place[]> => r.status === 'fulfilled')
      .map((r) => r.value);

    const seen = new Set<string>();
    const merged: Place[] = [];
    const maxLen = Math.max(...sets.map((s) => s.length), 0);

    for (let i = 0; i < maxLen && merged.length < limit; i++) {
      for (const set of sets) {
        if (merged.length >= limit) break;
        const place = set[i];
        if (place && !seen.has(place.id)) {
          seen.add(place.id);
          merged.push(place);
        }
      }
    }

    return merged;
  }

  // ── 카카오 응답 → 내부 Place 타입으로 변환 ─────────────────────────────────
  private toPlace(p: KakaoPlace): Place {
    const category = this.detectCategory(p.category_group_code, p.place_name);
    const categoryLabel = CATEGORY_LABEL[category] ?? '기타';
    const distanceM =
      p.distance != null && p.distance !== ''
        ? parseInt(p.distance, 10)
        : undefined;

    return {
      id: `kakao_${p.id}`,
      name: p.place_name,
      category,
      categoryLabel,
      address: p.road_address_name || p.address_name,
      lat: parseFloat(p.y),
      lng: parseFloat(p.x),
      phone: p.phone || undefined,
      placeUrl: p.place_url,
      rating: 0, // 카카오는 평점 미제공 → 추후 DB 보완
      reviewCount: 0,
      tags: [p.category_group_name].filter(Boolean),
      distance:
        distanceM != null && !isNaN(distanceM)
          ? this.formatDistance(distanceM)
          : undefined,
      imageUrl: CATEGORY_IMAGE[category] ?? CATEGORY_IMAGE['ETC'],
      isSponsored: false,
    };
  }

  private formatDistance(meters: number): string {
    return meters < 1000
      ? `${meters.toString()}m`
      : `${(meters / 1000).toFixed(1)}km`;
  }

  // 카카오 카테고리 코드 + 장소명으로 세부 카테고리 판별
  private detectCategory(code: string, name: string): string {
    if (code && CATEGORY_MAP[code]) return CATEGORY_MAP[code];
    const n = name;
    if (/노래방|코인노래|노래연습/.test(n)) return 'KARAOKE';
    if (/볼링/.test(n)) return 'BOWLING';
    if (/찜질|사우나|스파|온천|한증/.test(n)) return 'SPA';
    if (/방탈출|이스케이프/.test(n)) return 'ESCAPE';
    if (/오락실|게임센터|아케이드/.test(n)) return 'ARCADE';
    if (/PC방|피씨방|컴퓨터/.test(n)) return 'ETC';
    if (/공원|숲|산책/.test(n)) return 'PARK';
    if (/갤러리|전시|미술관|박물관/.test(n)) return 'CULTURAL';
    if (/서점|책방|도서관/.test(n)) return 'BOOKSTORE';
    return 'ETC';
  }
}

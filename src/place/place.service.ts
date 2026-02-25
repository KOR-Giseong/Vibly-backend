import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from './kakao.service';
import { GooglePlacesService } from './google-places.service';
import { PlaceCategory as PrismaPlaceCategory } from '@prisma/client';
import type { Place } from './types/kakao.types';

// 카테고리별 폴백 이미지 (카카오 검색 결과와 동일하게 Unsplash 고정 사진)
const CATEGORY_IMAGE: Record<string, string> = {
  CAFE: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80',
  RESTAURANT: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
  BAR: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=400&q=80',
  PARK: 'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=400&q=80',
  CULTURAL: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80',
  BOOKSTORE: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80',
  ETC: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&q=80',
};

export interface AIReason {
  icon: string;
  title: string;
  description: string;
}

@Injectable()
export class PlaceService {
  private readonly logger = new Logger(PlaceService.name);

  constructor(
    private prisma: PrismaService,
    private kakao: KakaoService,
    private googlePlaces: GooglePlacesService,
  ) {}

  // ── 주변 장소 (카카오 우선) ─────────────────────────────────────────────────
  async getNearby(lat: number, lng: number, radiusKm = 3, page = 1) {
    const kakaoResults = await this.kakao.searchNearby(lat, lng, radiusKm * 1000, page);

    if (kakaoResults.length > 0) {
      return await this.paginateKakao(kakaoResults, page);
    }

    this.logger.warn('카카오 결과 없음 → DB 폴백');
    const delta = radiusKm / 111;
    const places = await this.prisma.place.findMany({
      where: {
        isActive: true,
        lat: { gte: lat - delta, lte: lat + delta },
        lng: { gte: lng - delta, lte: lng + delta },
      },
      include: { images: { where: { isPrimary: true }, take: 1 }, tags: true },
      orderBy: { vibeScore: 'desc' },
      skip: (page - 1) * 15,
      take: 15,
    });
    return { data: places, page, hasNext: places.length === 15 };
  }

  // ── 키워드 검색 (카카오 우선) ───────────────────────────────────────────────
  async search(query: string, lat?: number, lng?: number, page = 1) {
    const kakaoResults = await this.kakao.searchByKeyword(query, lat, lng, page);

    if (kakaoResults.length > 0) {
      return await this.paginateKakao(kakaoResults, page);
    }

    this.logger.warn('카카오 검색 결과 없음 → DB 폴백');
    const places = await this.prisma.place.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { tags: { some: { tag: { contains: query, mode: 'insensitive' } } } },
        ],
      },
      include: { images: { where: { isPrimary: true }, take: 1 }, tags: true },
      orderBy: { vibeScore: 'desc' },
      skip: (page - 1) * 15,
      take: 15,
    });
    return { data: places, page, hasNext: places.length === 15 };
  }

  // ── 장소 상세 ──────────────────────────────────────────────────────────────
  async getById(id: string, userId?: string) {
    if (id.startsWith('kakao_')) {
      await this.upsertKakaoPlace(id);
    }

    const [place, myCheckInCount, myReview] = await Promise.all([
      this.prisma.place.findUnique({
        where: { id },
        include: {
          images: true,
          tags: true,
          reviews: {
            include: { user: { select: { id: true, name: true } } },
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      userId
        ? this.prisma.checkIn.count({ where: { userId, placeId: id } })
        : Promise.resolve(0),
      userId
        ? this.prisma.review.findUnique({
            where: { userId_placeId: { userId, placeId: id } },
            include: { user: { select: { id: true, name: true } } },
          })
        : Promise.resolve(null),
    ]);
    if (!place) throw new NotFoundException('장소를 찾을 수 없어요.');

    // Google Places 데이터 병렬 조회 (실패해도 무시)
    const googleData = await this.googlePlaces.getGoogleData(place.name, place.address).catch(() => null);

    // vibeScore 또는 rating 기반으로 감정 매칭 점수 계산
    const score =
      place.vibeScore > 0
        ? Math.round(place.vibeScore)
        : place.rating > 0
          ? Math.round((place.rating / 5) * 75 + 20)
          : 72;

    const vibeTags = this.generateVibeTags(place.category as string);
    const autoDescription =
      place.description ?? this.generateDescription(place.name, place.category as string);

    const dbImageUrl =
      place.images.find((i) => i.isPrimary)?.url ??
      place.images[0]?.url ??
      CATEGORY_IMAGE[place.category] ??
      CATEGORY_IMAGE['ETC'];

    return {
      ...place,
      tags: vibeTags,
      description: autoDescription,
      imageUrl: googleData?.imageUrl ?? dbImageUrl,
      // Vibly 평점: 실제 앱 리뷰(reviewCount)가 있을 때만 유효
      // reviewCount=0인데 rating>0인 경우는 이전 Google 데이터가 오염된 것 → 0 처리
      rating: place.reviewCount > 0 ? place.rating : 0,
      reviewCount: place.reviewCount,
      // Google 평점 (Google Places API)
      googleRating: googleData?.googleRating,
      googleReviewCount: googleData?.googleReviewCount,
      emotionMatch: vibeTags.slice(0, 3).map((tag, i) => ({
        label: tag,
        value: Math.min(99, Math.round(score * [1, 0.88, 0.78][i])),
      })),
      aiReasons: this.generateAiReasons(vibeTags, place.category, place.rating),
      myCheckInCount,
      myReview: myReview ?? null,
    };
  }

  // ── 북마크 토글 ────────────────────────────────────────────────────────────
  async toggleBookmark(userId: string, placeId: string) {
    if (placeId.startsWith('kakao_')) {
      await this.upsertKakaoPlace(placeId);
    }

    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_placeId: { userId, placeId } },
    });
    if (existing) {
      await this.prisma.bookmark.delete({
        where: { userId_placeId: { userId, placeId } },
      });
      return { bookmarked: false };
    }
    await this.prisma.bookmark.create({ data: { userId, placeId } });
    return { bookmarked: true };
  }

  // ── 북마크 목록 ────────────────────────────────────────────────────────────
  async getBookmarks(userId: string) {
    return this.prisma.bookmark.findMany({
      where: { userId },
      include: {
        place: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            tags: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── 리뷰 작성 / 수정 (1인 1리뷰 upsert) ──────────────────────────────────
  async addReview(userId: string, placeId: string, rating: number, body: string) {
    if (placeId.startsWith('kakao_')) {
      await this.upsertKakaoPlace(placeId);
    }

    const review = await this.prisma.review.upsert({
      where: { userId_placeId: { userId, placeId } },
      create: { userId, placeId, rating, body },
      update: { rating, body },
      include: { user: { select: { id: true, name: true } } },
    });

    // 평점 + 리뷰 수 재집계
    const agg = await this.prisma.review.aggregate({
      where: { placeId },
      _avg: { rating: true },
      _count: { id: true },
    });
    await this.prisma.place.update({
      where: { id: placeId },
      data: {
        rating: agg._avg.rating ?? rating,
        reviewCount: agg._count.id,
        vibeScore: Math.round(((agg._avg.rating ?? rating) / 5) * 85 + 10),
      },
    });

    return review;
  }

  // ── 리뷰 전체 목록 (페이지네이션) ──────────────────────────────────────────
  async getReviews(placeId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { placeId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { placeId } }),
    ]);
    return { reviews, total, page, hasNext: skip + reviews.length < total };
  }

  // ── 체크인 ─────────────────────────────────────────────────────────────────
  async checkIn(
    userId: string,
    placeId: string,
    mood: string,
    note?: string,
    imageUrl?: string,
  ) {
    if (placeId.startsWith('kakao_')) {
      await this.upsertKakaoPlace(placeId);
    }
    return this.prisma.checkIn.create({
      data: { userId, placeId, mood, note, imageUrl },
    });
  }

  // ── Public: 카카오 장소 목록을 DB로 일괄 upsert (MoodService 등에서 사용) ─
  async upsertKakaoPlaces(places: Place[]): Promise<void> {
    await Promise.all(places.map((p) => this.upsertKakaoPlace(p.id, p)));
  }

  // ── Private: 단일 카카오 장소 upsert ───────────────────────────────────────
  private readonly VALID_CATEGORIES = new Set<string>(
    Object.values(PrismaPlaceCategory),
  );

  private toValidCategory(cat: string): PrismaPlaceCategory {
    return this.VALID_CATEGORIES.has(cat)
      ? (cat as PrismaPlaceCategory)
      : PrismaPlaceCategory.ETC;
  }

  private async upsertKakaoPlace(kakaoId: string, place?: Place): Promise<void> {
    try {
      const data = place ?? (await this.fetchKakaoPlaceById(kakaoId));
      if (!data) {
        this.logger.warn(`카카오 장소 조회 실패: ${kakaoId}`);
        return;
      }

      await this.prisma.place.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          name: data.name,
          category: this.toValidCategory(data.category),
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          phone: data.phone ?? null,
          hours: data.hours ?? null,
          description: data.description ?? null,
          isActive: true,
          tags: {
            create: data.tags.filter(Boolean).map((tag) => ({ tag })),
          },
          ...(data.imageUrl && {
            images: {
              create: [{ url: data.imageUrl, isPrimary: true }],
            },
          }),
        },
        update: {
          name: data.name,
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          phone: data.phone ?? null,
          isActive: true,
          ...(data.hours && { hours: data.hours }),
          ...(data.description && { description: data.description }),
          ...(data.rating > 0 && {
            rating: data.rating,
            vibeScore: Math.round((data.rating / 5) * 85 + 10),
          }),
        },
      });
    } catch (err) {
      this.logger.error(`카카오 place upsert 실패 (${kakaoId})`, err);
    }
  }

  // ── Private: kakao_xxx ID로 DB에서 Place 정보 복원 ─────────────────────────
  private async fetchKakaoPlaceById(kakaoPlaceId: string): Promise<Place | null> {
    const existing = await this.prisma.place.findUnique({
      where: { id: kakaoPlaceId },
      include: { tags: true },
    });
    if (!existing) return null;

    return {
      id: existing.id,
      name: existing.name,
      category: existing.category as string,
      categoryLabel: existing.category,
      address: existing.address,
      lat: existing.lat,
      lng: existing.lng,
      phone: existing.phone ?? undefined,
      hours: existing.hours ?? undefined,
      description: existing.description ?? undefined,
      rating: existing.rating,
      reviewCount: existing.reviewCount,
      tags: existing.tags.map((t) => t.tag),
    };
  }

  // ── Public: DB 평점(앱 리뷰 반영)을 카카오 결과에 병합 ────────────────────
  async mergeDbRatings(places: Place[]): Promise<Place[]> {
    if (places.length === 0) return places;

    const ids = places.map((p) => p.id);
    const dbPlaces = await this.prisma.place.findMany({
      where: { id: { in: ids } },
      select: { id: true, rating: true, reviewCount: true, vibeScore: true },
    });
    const dbMap = new Map(dbPlaces.map((p) => [p.id, p]));

    return places.map((place) => {
      const db = dbMap.get(place.id);
      // 실제 앱 리뷰(reviewCount > 0)가 있을 때만 DB 평점 적용
      // reviewCount=0이면 이전 Google 데이터가 오염된 것 → 무시
      if (db && db.reviewCount > 0 && db.rating > 0) {
        return {
          ...place,
          rating: db.rating,
          reviewCount: db.reviewCount,
          ...(db.vibeScore != null && { vibeScore: db.vibeScore }),
        };
      }
      return { ...place, rating: 0, reviewCount: db?.reviewCount ?? 0 };
    });
  }

  // ── Private: 카카오 결과를 페이지네이션 형식으로 래핑 (DB 저장 + 평점 병합) ─
  private async paginateKakao(places: Place[], page: number) {
    // 상세 조회 시 404 방지 — DB에 먼저 저장
    await this.upsertKakaoPlaces(places);
    const merged = await this.mergeDbRatings(places);
    return {
      data: merged,
      page,
      total: merged.length,
      hasNext: merged.length === 15,
    };
  }

  // ── Private: 카테고리 기반 바이브 태그 생성 (2~5개) ──────────────────────
  private generateVibeTags(category: string): string[] {
    const map: Record<string, string[]> = {
      CAFE: ['아늑한', '감성적', '조용한', '커피 향기'],
      RESTAURANT: ['맛있는', '활기찬', '따뜻한', '분위기 좋은'],
      BAR: ['감성적', '분위기 있는', '야간', '어른스러운'],
      PARK: ['힐링', '자연 속', '평화로운', '산책하기 좋은'],
      CULTURAL: ['감성적', '예술적', '독특한', '영감을 주는'],
      BOOKSTORE: ['조용한', '지적인', '아늑한', '사색적인'],
      BOWLING: ['활기찬', '신나는', '친구와 함께'],
      KARAOKE: ['신나는', '흥겨운', '스트레스 해소'],
      SPA: ['힐링', '휴식', '편안한', '리프레시'],
      ESCAPE: ['스릴 있는', '두근두근', '도전적인'],
      ARCADE: ['신나는', '추억의', '활기찬'],
      ETC: ['독특한', '특별한', '분위기 좋은'],
    };
    return map[category] ?? map['ETC'];
  }

  // ── Private: 카테고리 기반 소개 자동 생성 ────────────────────────────────
  private generateDescription(name: string, category: string): string {
    const map: Record<string, string> = {
      CAFE: `감성적이고 아늑한 분위기의 카페예요. 향긋한 커피 한 잔과 함께 여유로운 시간을 즐겨보세요. 조용한 실내에서 작업하거나 대화 나누기에도 좋은 공간이에요.`,
      RESTAURANT: `분위기 좋고 따뜻한 감성의 맛집이에요. 정성스럽게 준비된 다양한 메뉴로 소중한 사람과 특별한 식사를 즐겨보세요.`,
      BAR: `감성 넘치는 분위기의 바예요. 감각적인 인테리어와 다양한 드링크로 특별한 밤을 만들어드릴 거예요.`,
      PARK: `도심 속 힐링 공간이에요. 자연 속에서 산책을 즐기며 여유로운 시간을 보내보세요. 일상의 피로를 풀기에 최적의 장소예요.`,
      CULTURAL: `감성적이고 예술적인 문화 공간이에요. 다양한 전시와 공연으로 새로운 영감과 특별한 경험을 선사해드릴 거예요.`,
      BOOKSTORE: `조용하고 아늑한 분위기의 서점이에요. 다양한 책들과 함께하는 사색적인 시간을 보내보세요.`,
      BOWLING: `활기차고 신나는 볼링장이에요. 친구나 가족과 함께 즐거운 시간을 보내보세요.`,
      KARAOKE: `신나고 흥겨운 노래방이에요. 스트레스를 날려버리고 즐거운 시간을 만들어보세요.`,
      SPA: `편안하고 힐링되는 스파 공간이에요. 일상의 피로를 말끔히 풀고 리프레시해보세요.`,
      ESCAPE: `스릴 넘치는 방탈출 카페예요. 친구들과 함께 두근두근한 도전을 즐겨보세요.`,
      ARCADE: `신나고 재미있는 오락실이에요. 다양한 게임으로 즐거운 시간을 보내보세요.`,
      ETC: `독특하고 특별한 분위기의 공간이에요. 일상에서 벗어나 색다른 경험을 즐길 수 있는 곳이에요.`,
    };
    const desc = map[category] ?? map['ETC'];
    return `${name} - ${desc}`;
  }

  // ── Private: 태그 + 카테고리 기반 AI 추천 이유 생성 ──────────────────────
  private generateAiReasons(
    tags: string[],
    category: string,
    rating: number,
  ): AIReason[] {
    const reasons: AIReason[] = [];

    const catMap: Record<string, AIReason> = {
      CAFE: { icon: '☕', title: '카페 감성', description: '향긋한 커피와 함께 여유로운 시간을 즐겨보세요' },
      RESTAURANT: { icon: '🍽️', title: '맛있는 음식', description: '입맛을 사로잡는 다양한 메뉴가 준비돼 있어요' },
      BAR: { icon: '🍸', title: '분위기 있는 밤', description: '감성 넘치는 야간 시간을 즐길 수 있어요' },
      PARK: { icon: '🌿', title: '자연 속 힐링', description: '도심 속 자연으로 마음이 편안해져요' },
      CULTURAL: { icon: '🎨', title: '문화 체험', description: '새로운 영감을 얻을 수 있는 공간이에요' },
      BOOKSTORE: { icon: '📚', title: '지식의 공간', description: '책과 함께하는 조용한 시간이 기다려요' },
      ETC: { icon: '✨', title: '특별한 공간', description: '색다른 경험이 기다리고 있어요' },
    };
    const catReason = catMap[category];
    if (catReason) reasons.push(catReason);

    const tagMap: Record<string, AIReason> = {
      아늑한: { icon: '🛋️', title: '아늑한 분위기', description: '당신이 찾는 편안함이 있어요' },
      조용한: { icon: '🎵', title: '조용한 환경', description: '집중하기 좋은 차분한 공간이에요' },
      감성: { icon: '🪟', title: '감성 충전', description: '인스타 감성 가득한 분위기에요' },
      뷰: { icon: '🌆', title: '아름다운 뷰', description: '탁 트인 전망을 즐길 수 있어요' },
      힐링: { icon: '🌿', title: '힐링 공간', description: '지친 마음을 쉬게 해드려요' },
      루프탑: { icon: '🌇', title: '루프탑 뷰', description: '도시의 전경을 한눈에 담아봐요' },
      애견동반: { icon: '🐾', title: '반려동물 동반', description: '소중한 친구와 함께할 수 있어요' },
      야외: { icon: '☀️', title: '야외 공간', description: '탁 트인 야외에서 즐기는 특별함' },
      데이트: { icon: '💕', title: '데이트 명소', description: '소중한 사람과 함께하기 딱 좋아요' },
      북카페: { icon: '📖', title: '독서하기 좋은', description: '책 읽기에 최적화된 환경이에요' },
    };
    for (const tag of tags) {
      if (reasons.length >= 3) break;
      const r = tagMap[tag];
      if (r && !reasons.some((e) => e.title === r.title)) reasons.push(r);
    }

    const extras: AIReason[] = [
      {
        icon: '⭐',
        title: '높은 평점',
        description: `${rating.toFixed(1)}점의 검증된 인기 장소예요`,
      },
      { icon: '📍', title: '찾기 쉬운 위치', description: '대중교통으로 쉽게 찾아갈 수 있어요' },
      { icon: '💝', title: '많은 방문자', description: '수많은 사람들이 사랑하는 곳이에요' },
    ];
    for (const ex of extras) {
      if (reasons.length >= 3) break;
      reasons.push(ex);
    }

    return reasons.slice(0, 3);
  }
}

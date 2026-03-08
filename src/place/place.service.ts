import { Injectable, Logger, NotFoundException, UnprocessableEntityException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from './kakao.service';
import { GooglePlacesService } from './google-places.service';
import { PlaceCategory as PrismaPlaceCategory } from '@prisma/client';
import type { Place } from './types/kakao.types';
import { OcrService } from '../ocr/ocr.service';
import { ReceiptMatcherService } from '../ocr/receipt-matcher.service';
import { CreditService, CREDIT_REWARDS, CreditTxType } from '../credit/credit.service';
import { NotificationService } from '../notification/notification.service';
import { assertNoProfanity } from '../utils/profanity.filter';

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

// ── 카테고리별 체크인 방식 ────────────────────────────────────────────────────
const RECEIPT_REQUIRED_CATEGORIES = ['CAFE', 'RESTAURANT', 'BAR']; // 영수증 필수
const GPS_ONLY_CATEGORIES = ['PARK', 'CULTURAL'];                   // GPS 필수

@Injectable()
export class PlaceService {
  private readonly logger = new Logger(PlaceService.name);

  constructor(
    private prisma: PrismaService,
    private kakao: KakaoService,
    private googlePlaces: GooglePlacesService,
    private config: ConfigService,
    private ocr: OcrService,
    private receiptMatcher: ReceiptMatcherService,
    private creditService: CreditService,
    private notificationService: NotificationService,
  ) {}

  // ── 주변 장소 (카카오에서 바로 호출, DB 저장 없이 반환) ──────────────────
  async getNearby(lat: number, lng: number, radiusM = 2000, page = 1, limit = 20) {
    const kakaoResults = await this.kakao.searchNearby(lat, lng, radiusM, page, limit);

    if (kakaoResults.length > 0) {
      const merged = await this.mergeDbRatings(kakaoResults);
      return { data: merged, page, total: merged.length, hasNext: merged.length >= limit };
    }

    this.logger.warn('카카오 결과 없음 → DB 폴백');
    const delta = radiusM / 111000;
    const places = await this.prisma.place.findMany({
      where: {
        isActive: true,
        lat: { gte: lat - delta, lte: lat + delta },
        lng: { gte: lng - delta, lte: lng + delta },
      },
      include: { images: { where: { isPrimary: true }, take: 1 }, tags: true },
      orderBy: { vibeScore: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: places, page, hasNext: places.length >= limit };
  }

  // ── 키워드 검색 (카카오에서 바로 호출, DB 저장 없이 반환) ──────────────────
  async search(query: string, lat?: number, lng?: number, page = 1, limit = 20) {
    const kakaoResults = await this.kakao.searchByKeyword(query, lat, lng, page, 'distance', limit);

    if (kakaoResults.length > 0) {
      const merged = await this.mergeDbRatings(kakaoResults);
      return { data: merged, page, total: merged.length, hasNext: merged.length >= limit };
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
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: places, page, hasNext: places.length >= limit };
  }

  // ── 장소 상세 ──────────────────────────────────────────────────────────────
  async getById(id: string, userId?: string, hint?: { name: string; lat: number; lng: number }, mood?: string, vibes?: string[]) {
    if (id.startsWith('kakao_')) {
      await this.upsertKakaoPlace(id, undefined, hint);
    }

    const [place, myCheckInCount, myReview, myBookmark] = await Promise.all([
      this.prisma.place.findUnique({
        where: { id },
        include: {
          images: true,
          tags: true,
          reviews: {
            include: {
              user: { select: { id: true, name: true } },
              _count: { select: { likes: true } },
              ...(userId ? { likes: { where: { userId }, select: { id: true } } } : {}),
            },
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
      userId
        ? this.prisma.bookmark.findUnique({ where: { userId_placeId: { userId, placeId: id } } })
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

    const categoryVibes = this.generateVibeTags(place.category as string);
    const vibeTags = mood
      ? this.personalizeByMood(mood, categoryVibes)
      : (vibes && vibes.length > 0)
        ? this.personalizeByVibes(vibes, categoryVibes)
        : categoryVibes;
    const autoDescription =
      place.description ?? this.generateDescription(place.name, place.category as string);

    const dbImageUrl =
      place.images.find((i) => i.isPrimary)?.url ??
      place.images[0]?.url ??
      CATEGORY_IMAGE[place.category] ??
      CATEGORY_IMAGE['ETC'];

    // Google에서 새 이미지 URL을 받았으면 DB 갱신 (만료 URL 방지)
    if (googleData?.imageUrl && googleData.imageUrl !== dbImageUrl) {
      this.prisma.placeImage
        .deleteMany({ where: { placeId: place.id } })
        .then(() =>
          this.prisma.placeImage.create({
            data: { placeId: place.id, url: googleData.imageUrl!, isPrimary: true },
          }),
        )
        .catch(() => {});
    }

    return {
      ...place,
      vibeScore: score, // 항상 계산된 점수 반환 (DB의 0 덮어씀)
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
      isBookmarked: !!myBookmark,
      myCheckInCount,
      myReview: myReview ?? null,
      reviews: place.reviews.map((r: any) => ({
        id: r.id,
        user: r.user,
        rating: r.rating,
        body: r.body,
        createdAt: r.createdAt,
        likesCount: r._count?.likes ?? 0,
        isLiked: userId ? (r.likes?.length ?? 0) > 0 : false,
      })),
    };
  }

  // ── 북마크 토글 ────────────────────────────────────────────────────────────
  async toggleBookmark(userId: string, placeId: string, imageUrl?: string) {
    if (placeId.startsWith('kakao_')) {
      await this.upsertKakaoPlace(placeId);
    }

    // imageUrl이 전달되면 Google 실제 이미지로 교체 (카테고리 기본 이미지보다 우선)
    if (imageUrl) {
      await this.prisma.place.update({
        where: { id: placeId },
        data: {
          images: {
            deleteMany: {},
            create: [{ url: imageUrl, isPrimary: true }],
          },
        },
      }).catch(() => {});
    }

    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_placeId: { userId, placeId } },
    });
    if (existing) {
      await this.prisma.bookmark.delete({
        where: { userId_placeId: { userId, placeId } },
      });
      return { isBookmarked: false };
    }
    await this.prisma.bookmark.create({ data: { userId, placeId } });
    return { isBookmarked: true };
  }

  // ── Google Places 사진 URL을 현재 API 키로 재생성 ─────────────────────────
  private refreshGooglePhotoUrl(url: string): string {
    try {
      const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
      if (!apiKey || !url.includes('places.googleapis.com')) return url;
      const urlObj = new URL(url);
      urlObj.searchParams.set('key', apiKey);
      return urlObj.toString();
    } catch {
      return url;
    }
  }

    // ── 북마크 목록 ────────────────────────────────────────────────────────────
  async getBookmarks(userId: string) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId },
      include: {
        place: {
          include: {
            images: { take: 1 },
            tags: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 이미지가 없는 장소는 Google Places에서 실시간 보완
    const enriched = await Promise.all(
      bookmarks.map(async (b) => {
        const p = b.place;
        let rawImageUrl = p.images[0]?.url;
        this.logger.log(`[bookmark] ${p.name} | dbImages: ${p.images.length} | raw: ${rawImageUrl?.slice(0,50)}`);

        if (!rawImageUrl) {
          try {
            const googleData = await this.googlePlaces.getGoogleData(p.name, p.address);
            if (googleData?.imageUrl) {
              rawImageUrl = googleData.imageUrl;
              // DB에도 저장해서 다음에는 바로 사용
              await this.prisma.place.update({
                where: { id: p.id },
                data: {
                  images: { create: [{ url: rawImageUrl, isPrimary: true }] },
                },
              }).catch(() => {/* 저장 실패해도 무시 */});
            }
          } catch {
            // Google 실패 시 fallback 사용
          }
        }

        const imageUrl = this.refreshGooglePhotoUrl(
          rawImageUrl ?? CATEGORY_IMAGE[p.category] ?? CATEGORY_IMAGE['ETC'],
        );
        this.logger.log(`[bookmark] ${p.name} | image: ${imageUrl?.slice(0, 60)}`);
        return { imageUrl, b, p };
      }),
    );

    return enriched.map(({ imageUrl, b, p }) => {
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        categoryLabel: this.toCategoryLabel(p.category),
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        rating: p.reviewCount > 0 ? p.rating : 0,
        reviewCount: p.reviewCount,
        imageUrl,
        tags: p.tags.map((t) => t.tag),
        isBookmarked: true,
        savedAt: b.createdAt,
      };
    });
  }

  private toCategoryLabel(category: string): string {
    const map: Record<string, string> = {
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
    return map[category] ?? '기타';
  }

  // ── 리뷰 작성 / 수정 (1인 1리뷰 upsert) ──────────────────────────────────
  async addReview(userId: string, placeId: string, rating: number, body: string) {
    if (body) assertNoProfanity(body, '리뷰');
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
  async getReviews(placeId: string, page = 1, limit = 20, userId?: string) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { placeId },
        include: {
          user: { select: { id: true, name: true } },
          _count: { select: { likes: true } },
          ...(userId
            ? { likes: { where: { userId }, select: { id: true } } }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { placeId } }),
    ]);

    const mapped = reviews.map((r: any) => ({
      id: r.id,
      user: r.user,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt,
      likesCount: r._count.likes,
      isLiked: userId ? (r.likes?.length ?? 0) > 0 : false,
    }));

    return { reviews: mapped, total, page, hasNext: skip + reviews.length < total };
  }

  // ── 리뷰 좋아요 ──────────────────────────────────────────────────────────
  async likeReview(userId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true },
    });
    if (!review) throw new Error('리뷰를 찾을 수 없어요.');

    await this.prisma.reviewLike.upsert({
      where: { userId_reviewId: { userId, reviewId } },
      create: { userId, reviewId },
      update: {},
    });

    // 자신의 리뷰에 첨다른 사람이 좋아요 누르면 알림
    if (review.userId !== userId) {
      void this.notificationService.send(
        review.userId,
        'LIKE',
        '리뷰 좋아요',
        '누군가 회원님의 리뷰를 좋아해요! ♥',
        { reviewId },
      ).catch(() => {});
    }

    const count = await this.prisma.reviewLike.count({ where: { reviewId } });
    return { likesCount: count };
  }

  // ── 리뷰 좋아요 취소 ─────────────────────────────────────────────────────
  async unlikeReview(userId: string, reviewId: string) {
    await this.prisma.reviewLike
      .deleteMany({ where: { userId, reviewId } })
      .catch(() => {});
    const count = await this.prisma.reviewLike.count({ where: { reviewId } });
    return { likesCount: count };
  }

  // ── 체크인 (영수증 OCR 필수) ───────────────────────────────────────────────
  async checkInWithReceipt(
    userId: string,
    placeId: string,
    receiptBuffer: Buffer | null,
    mood: string,
    note?: string,
    lat?: number,
    lng?: number,
  ) {
    // ── 1. 카카오 장소 DB upsert ────────────────────────────────────────────
    if (placeId.startsWith('kakao_')) {
      await this.upsertKakaoPlace(placeId);
    }

    // ── 2. 장소 정보 조회 ────────────────────────────────────────────────────
    const place = await this.prisma.place.findUnique({ where: { id: placeId } });
    if (!place) throw new NotFoundException('장소를 찾을 수 없습니다.');

    // ── 3. 카테고리별 체크인 방식 검증 ─────────────────────────────────────
    const category = place.category as string;
    const hasReceipt = !!(receiptBuffer && receiptBuffer.length > 0);
    const hasGps = lat != null && lng != null;

    if (RECEIPT_REQUIRED_CATEGORIES.includes(category) && !hasReceipt) {
      throw new BadRequestException(
        `${this.toCategoryLabel(category)}는 영수증으로만 체크인할 수 있어요.`,
      );
    }
    if (GPS_ONLY_CATEGORIES.includes(category) && !hasGps) {
      throw new BadRequestException(
        `${this.toCategoryLabel(category)}는 GPS로만 체크인할 수 있어요.`,
      );
    }

    // ── 4. 악용 방지 공통 체크 ───────────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 3-1. 하루 최대 10회 체크인
    const todayTotal = await this.prisma.checkIn.count({
      where: { userId, createdAt: { gte: todayStart, lte: todayEnd } },
    });
    if (todayTotal >= 10) {
      throw new BadRequestException(
        '오늘은 더 이상 체크인할 수 없어요. 하루 최대 10회까지 가능해요.',
      );
    }

    // 3-2. 같은 장소 하루 1회 제한
    const alreadyToday = await this.prisma.checkIn.count({
      where: { userId, placeId, createdAt: { gte: todayStart, lte: todayEnd } },
    });
    if (alreadyToday > 0) {
      throw new BadRequestException(
        `${place.name}은(는) 오늘 이미 체크인했어요. 내일 다시 방문해주세요.`,
      );
    }

    // ── 5. 인증 방식별 처리 ──────────────────────────────────────────────────
    let receiptVerified = false;
    let receiptHash: string | null = null;

    if (receiptBuffer && receiptBuffer.length > 0) {
      // ── 4-A. 영수증 OCR 방식 ─────────────────────────────────────────────

      // 4-A-1. 영수증 해시 중복 검사 (동일 이미지 재사용 방지)
      receiptHash = createHash('sha256').update(receiptBuffer).digest('hex');
      const duplicateReceipt = await this.prisma.checkIn.findFirst({
        where: { receiptHash },
      });
      if (duplicateReceipt) {
        throw new BadRequestException(
          '이미 사용된 영수증이에요. 같은 영수증으로 중복 체크인은 불가해요.',
        );
      }

      // 4-A-2. OCR 텍스트 추출
      let lines: string[];
      try {
        lines = await this.ocr.extractLines(receiptBuffer);
      } catch (err) {
        this.logger.error('OCR 처리 실패', err);
        throw new UnprocessableEntityException(
          'OCR 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
        );
      }

      if (!lines.length) {
        throw new UnprocessableEntityException(
          '영수증에서 텍스트를 인식할 수 없어요. 선명하게 다시 찍어주세요.',
        );
      }

      // 4-A-3. 매장명 퍼지 매칭
      const { matched, confidence, extractedName } =
        this.receiptMatcher.matchStoreName(lines, place.name);

      this.logger.log(
        `[영수증검증] place=${place.name} | extracted=${extractedName} | confidence=${confidence} | matched=${matched}`,
      );

      if (!matched) {
        throw new UnprocessableEntityException(
          `영수증 매장명이 일치하지 않아요. 인식된 매장: "${extractedName ?? '없음'}"`,
        );
      }
      receiptVerified = true;
    } else {
      // ── 4-B. GPS 방식 ─────────────────────────────────────────────────────
      if (lat == null || lng == null) {
        throw new BadRequestException('영수증 또는 현재 위치 정보가 필요해요.');
      }

      if (!place.lat || !place.lng) {
        throw new UnprocessableEntityException(
          '이 장소는 좌표 정보가 없어 GPS 체크인이 불가해요. 영수증으로 체크인해주세요.',
        );
      }

      // 4-B-1. 거리 검증
      const distanceM = this.haversineDistance(lat, lng, place.lat, place.lng);
      this.logger.log(
        `[GPS검증] place=${place.name} | placeLat=${place.lat} placeLng=${place.lng} | userLat=${lat} userLng=${lng} | distance=${Math.round(distanceM)}m`,
      );

      if (distanceM > 100) {
        throw new UnprocessableEntityException(
          `현재 위치가 ${place.name}에서 너무 멀어요. (${Math.round(distanceM)}m 떨어짐, 100m 이내 필요)`,
        );
      }

      // 4-B-2. GPS 쿨다운: 같은 장소 GPS 체크인 2시간 이내 재시도 방지
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const recentGpsCheckIn = await this.prisma.checkIn.findFirst({
        where: {
          userId,
          placeId,
          receiptVerified: false,
          createdAt: { gte: twoHoursAgo },
        },
      });
      if (recentGpsCheckIn) {
        const nextAvailable = new Date(recentGpsCheckIn.createdAt.getTime() + 2 * 60 * 60 * 1000);
        const remainMin = Math.ceil((nextAvailable.getTime() - Date.now()) / 60000);
        throw new BadRequestException(
          `GPS 체크인은 같은 장소에서 2시간에 1번만 가능해요. ${remainMin}분 후 다시 시도해주세요.`,
        );
      }

      receiptVerified = false;
    }

    // ── 6. 체크인 생성 ────────────────────────────────────────────────────────
    const checkIn = await this.prisma.checkIn.create({
      data: { userId, placeId, mood, note, receiptVerified, receiptHash },
    });

    // ── 7. 크레딧 보상 (비동기, 실패해도 체크인은 완료) ────────────────────
    const rewardType = receiptVerified ? CreditTxType.CHECKIN_RECEIPT : CreditTxType.CHECKIN_GPS;
    const rewardAmount = receiptVerified ? CREDIT_REWARDS.CHECKIN_RECEIPT : CREDIT_REWARDS.CHECKIN_GPS;
    this.creditService.earn(userId, rewardAmount, rewardType, checkIn.id).catch((err) =>
      this.logger.error(`체크인 크레딧 지급 실패 userId=${userId}`, err),
    );

    return { ...checkIn, creditEarned: rewardAmount };
  }

  /** Haversine 공식: 두 좌표 간 거리(미터) */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // 지구 반지름 (미터)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── 체크인 (레거시 - 내부 호환용, 외부 노출 X) ─────────────────────────────
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

  // ── 내 체크인 기록 목록 ──────────────────────────────────────────────────────
  async getMyCheckins(userId: string) {
    const checkins = await this.prisma.checkIn.findMany({
      where: { userId },
      include: {
        place: {
          include: { images: { take: 1 } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return checkins.map((c) => {
      const p = c.place;
      const imageUrl =
        p.images[0]?.url ??
        CATEGORY_IMAGE[p.category] ??
        CATEGORY_IMAGE['ETC'];
      return {
        id: c.id,
        placeId: p.id,
        placeName: p.name,
        category: p.category,
        address: p.address,
        imageUrl,
        mood: c.mood,
        note: c.note,
        imageUrl_checkin: c.imageUrl,
        createdAt: c.createdAt,
      };
    });
  }

  // ── 내 리뷰 목록 ───────────────────────────────────────────────────
  async getMyReviews(userId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { userId },
      include: {
        place: {
          include: { images: { take: 1 } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => {
      const p = r.place;
      const imageUrl =
        p.images[0]?.url ??
        CATEGORY_IMAGE[p.category] ??
        CATEGORY_IMAGE['ETC'];
      return {
        id: r.id,
        placeId: p.id,
        placeName: p.name,
        category: p.category,
        address: p.address,
        imageUrl,
        rating: r.rating,
        body: r.body,
        createdAt: r.createdAt,
      };
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

  private async upsertKakaoPlace(
    kakaoId: string,
    place?: Place,
    hint?: { name: string; lat: number; lng: number },
  ): Promise<void> {
    try {
      const data = place ?? (await this.fetchKakaoPlaceById(kakaoId, hint));
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
          // Unsplash 카테고리 이미지(기본 이미지)는 DB 기존 이미지를 덮어쓰지 않음
          // Google Places 이미지(실제 이미지)가 있을 때만 업데이트
          ...(data.imageUrl && !data.imageUrl.includes('unsplash.com') && {
            images: {
              deleteMany: {},
              create: [{ url: data.imageUrl, isPrimary: true }],
            },
          }),
        },
      });
    } catch (err) {
      this.logger.error(`카카오 place upsert 실패 (${kakaoId})`, err);
    }
  }

  // ── Private: kakao_xxx ID로 Place 정보 복원 (DB → Kakao 검색 순으로 폴백) ──
  private async fetchKakaoPlaceById(
    kakaoPlaceId: string,
    hint?: { name: string; lat: number; lng: number },
  ): Promise<Place | null> {
    // 1) DB 먼저 확인
    const existing = await this.prisma.place.findUnique({
      where: { id: kakaoPlaceId },
      include: { tags: true },
    });

    // DB에 있는데 lat/lng가 없는 경우 → Kakao 재조회로 좌표 보충 시도
    if (existing && (!existing.lat || !existing.lng)) {
      this.logger.warn(`[fetchKakaoPlace] lat/lng 누락 → Kakao 재조회: ${existing.name} (${kakaoPlaceId})`);
      const searchLat = hint?.lat ?? 37.5665;
      const searchLng = hint?.lng ?? 126.9780;
      const searchName = hint?.name ?? existing.name;
      try {
        const results = await this.kakao.searchByKeyword(searchName, searchLat, searchLng, 5, 'distance', 15);
        const matched = results.find((p) => p.id === kakaoPlaceId);
        if (matched && matched.lat && matched.lng) return matched;
      } catch (e) {
        this.logger.warn(`[fetchKakaoPlace] Kakao 재조회 실패: ${e}`);
      }
      // Kakao 재조회 실패해도 기존 DB 데이터 반환 (좌표 없이)
    }

    if (existing) {
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

    // 2) DB에 없고 hint(name + coords)가 있으면 Kakao 키워드 검색으로 폴백
    // distance 정렬 + 반경 없음 → 좌표 기준 가장 가까운 동명 장소 순으로 반환
    if (hint) {
      const results = await this.kakao.searchByKeyword(hint.name, hint.lat, hint.lng, 1, 'distance', 15);
      const matched = results.find((p) => p.id === kakaoPlaceId);
      if (matched) return matched;
    }

    return null;
  }

  // ── Public: DB 평점(앱 리뷰 반영)을 카카오 결과에 병합 ────────────────────
  async mergeDbRatings(places: Place[]): Promise<Place[]> {
    if (places.length === 0) return places;

    const ids = places.map((p) => p.id);
    const dbPlaces = await this.prisma.place.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        rating: true,
        reviewCount: true,
        vibeScore: true,
        images: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    const dbMap = new Map(dbPlaces.map((p) => [p.id, p]));

    return places.map((place) => {
      const db = dbMap.get(place.id);
      // DB에 저장된 실제 이미지가 있으면 Kakao 카테고리 이미지 대신 사용
      const imageUrl = db?.images?.[0]?.url ?? place.imageUrl;

      // 실제 앱 리뷰(reviewCount > 0)가 있을 때만 DB 평점 적용
      // reviewCount=0이면 이전 Google 데이터가 오염된 것 → 무시
      if (db && db.reviewCount > 0 && db.rating > 0) {
        return {
          ...place,
          imageUrl,
          rating: db.rating,
          reviewCount: db.reviewCount,
          vibeScore: (db.vibeScore != null && db.vibeScore > 0)
            ? db.vibeScore
            : this.categoryVibeScore(place.category),
        };
      }
      // DB 리뷰 없음 → 카테고리 기반 기본 바이브 점수 부여
      const vibeScore = (db?.vibeScore != null && db.vibeScore > 0)
        ? db.vibeScore
        : this.categoryVibeScore(place.category);
      return { ...place, imageUrl, rating: 0, reviewCount: db?.reviewCount ?? 0, vibeScore };
    });
  }

  // ── Private: 카테고리별 기본 바이브 점수 ──────────────────────────────────
  private categoryVibeScore(category: string): number {
    const scores: Record<string, number> = {
      CAFE: 82,
      RESTAURANT: 80,
      BAR: 78,
      PARK: 85,
      CULTURAL: 88,
      BOOKSTORE: 83,
      BOWLING: 79,
      KARAOKE: 80,
      SPA: 85,
      ESCAPE: 82,
      ARCADE: 78,
      ETC: 75,
    };
    return scores[category] ?? 75;
  }

  // ── Private: 무드 기반 바이브 태그 개인화 ────────────────────────────────
  private personalizeByMood(mood: string, categoryVibes: string[]): string[] {
    const moodMap: Record<string, string[]> = {
      '행복해요':  ['즐거운', '활기찬', '분위기 좋은', '따뜻한'],
      '평온해요':  ['조용한', '아늑한', '평화로운', '차분한'],
      '신나요':    ['활기찬', '신나는', '에너지 넘치는', '흥겨운'],
      '우울해요':  ['아늑한', '따뜻한', '위로가 되는', '조용한'],
      '생각중':    ['사색적인', '조용한', '지적인', '차분한'],
      '열정적':    ['영감을 주는', '활기찬', '도전적인', '에너지 넘치는'],
    };
    const moodVibes = moodMap[mood] ?? [];
    // 무드 태그를 앞에, 카테고리 태그(중복 제거)를 뒤에 합쳐 최대 4개 반환
    const merged = [...moodVibes, ...categoryVibes.filter(v => !moodVibes.includes(v))];
    return merged.slice(0, 4);
  }

  // ── Private: 선호 바이브 기반 태그 개인화 ────────────────────────────────
  private personalizeByVibes(preferredVibes: string[], categoryVibes: string[]): string[] {
    // 선호 바이브를 앞에, 카테고리 태그(중복 제거)를 뒤에 합쳐 최대 4개 반환
    const merged = [...preferredVibes, ...categoryVibes.filter(v => !preferredVibes.includes(v))];
    return merged.slice(0, 4);
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

  // ── 실시간 상황 기반 추천 (프리미엄 전용) ──────────────────────────────────────
  async smartRecommend(userId: string, lat: number, lng: number, mode: 'nearby' | 'wide' = 'nearby', regionName?: string) {
    const subscribed = await this.creditService.isSubscribed(userId);
    if (!subscribed) {
      throw new ForbiddenException('실시간 추천은 프리미엄 기능이에요. 구독 후 이용해주세요!');
    }

    // 1. 날씨 조회 (Open-Meteo - 무료, API 키 불필요, 더 안정적)
    const WMO_CODES: Record<number, string> = {
      0: '맑음', 1: '대체로 맑음', 2: '부분 흐림', 3: '흐림',
      45: '안개', 48: '안개',
      51: '이슬비', 53: '이슬비', 55: '강한 이슬비',
      61: '비', 63: '비', 65: '강한 비',
      71: '눈', 73: '눈', 75: '강한 눈',
      77: '싸락눈',
      80: '소나기', 81: '소나기', 82: '강한 소나기',
      85: '눈 소나기', 86: '강한 눈 소나기',
      95: '뇌우', 96: '뇌우', 99: '뇌우(우박)',
    };
    let weather = '맑음';
    try {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json() as { current_weather?: { weathercode: number; temperature: number } };
        const code = weatherData.current_weather?.weathercode ?? -1;
        const temp = Math.round(weatherData.current_weather?.temperature ?? 0);
        const desc = WMO_CODES[code] ?? '흐림';
        weather = `${desc} ${temp}°C`;
      }
    } catch {
      this.logger.warn('날씨 API 호출 실패, 기본값 사용');
    }

    // 2. 시간대 계산 (KST)
    const kstHour = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
    let timeOfDay: string;
    if (kstHour >= 5 && kstHour < 12) timeOfDay = '아침';
    else if (kstHour >= 12 && kstHour < 17) timeOfDay = '오후';
    else if (kstHour >= 17 && kstHour < 22) timeOfDay = '저녁';
    else timeOfDay = '심야';

    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const dayOfWeek = dayNames[new Date().getDay()];

    // 3. Gemini로 장소 키워드 추천
    const prompt = `지금 ${dayOfWeek} ${timeOfDay}, 날씨는 "${weather}"입니다.
이 상황에 어울리는 데이트 장소 카테고리 키워드 3개를 JSON으로 답하세요.
형식: {"message": "한 줄 추천 멘트 (20자 이내)", "keywords": ["키워드1", "키워드2", "키워드3"]}`;

    let keywords = ['카페', '공원', '맛집'];
    let message = `${timeOfDay}에 어울리는 장소를 찾아봤어요`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.config.get('GEMINI_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 200, responseMimeType: 'application/json' },
          }),
        },
      );
      const data = await res.json() as any;
      const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.keywords)) keywords = parsed.keywords.slice(0, 3);
        if (parsed.message) message = parsed.message;
      }
    } catch (e) {
      this.logger.warn('스마트 추천 Gemini 오류, 폴백 키워드 사용', e);
    }

    // 4. 카카오 병렬 검색
    // nearby: 현재 위치 기준 distance 정렬 (20km 반경, Kakao 최대값)
    // wide: 선택된 지역명 + 키워드로 accuracy 정렬
    const regionPrefix = regionName ?? '서울';
    const results = await Promise.all(
      mode === 'wide'
        ? keywords.map((kw) => this.kakao.searchByKeyword(`${regionPrefix} ${kw}`, undefined, undefined, 1, 'accuracy', 5))
        : keywords.map((kw) => this.kakao.searchByKeyword(kw, lat, lng, 1, 'distance', 5, 20000)),
    );
    // 중복 ID 제거 후 최대 9개
    const seen = new Set<string>();
    const places = results
      .flatMap((r) => r.slice(0, 3))
      .filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .slice(0, 9);

    // 추천 장소를 백그라운드로 DB upsert → 탭 시 getById 안정적으로 동작
    this.upsertKakaoPlaces(places).catch(() => {});

    return { message, weather, timeOfDay, keywords, places, mode };
  }

  // ── AI 리뷰 요약 (프리미엄 전용) ─────────────────────────────────────────────
  async getReviewSummary(placeId: string, userId: string) {
    // 프리미엄 체크
    const subscribed = await this.creditService.isSubscribed(userId);
    if (!subscribed) {
      throw new ForbiddenException('AI 리뷰 요약은 프리미엄 기능이에요. 구독 후 이용해주세요!');
    }

    // 현재 리뷰 수 조회
    const reviewCount = await this.prisma.review.count({ where: { placeId } });

    // 캐시 확인 (리뷰 수가 동일하면 캐시 반환)
    const cached = await this.prisma.placeReviewSummary.findUnique({ where: { placeId } });
    if (cached && cached.reviewCount === reviewCount) {
      return cached;
    }

    // 리뷰가 없으면 기본 응답
    if (reviewCount === 0) {
      return {
        placeId,
        summary: '아직 리뷰가 없어요. 첫 번째 리뷰를 남겨보세요!',
        pros: [],
        cons: [],
        targetAudience: null,
        reviewCount: 0,
        generatedAt: new Date(),
      };
    }

    // 최대 50개 리뷰 텍스트 조회
    const reviews = await this.prisma.review.findMany({
      where: { placeId },
      select: { rating: true, body: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const reviewTexts = reviews
      .map((r) => `[${r.rating}점] ${r.body}`)
      .join('\n');

    // Gemini AI 요약 생성
    const prompt = `다음은 한 장소에 대한 실제 리뷰 목록입니다. JSON 형식으로 분석해주세요.
분석 형식:
{
  "summary": "한 줄 요약 (50자 이내)",
  "pros": ["장점1", "장점2", "장점3"],
  "cons": ["단점1", "단점2"],
  "targetAudience": "이런 분께 추천 (20자 이내)"
}

리뷰:
${reviewTexts}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.config.get('GEMINI_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 500,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      const data = await res.json() as any;
      const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const result = await this.prisma.placeReviewSummary.upsert({
          where: { placeId },
          create: {
            placeId,
            summary: parsed.summary ?? '요약 정보 없음',
            pros: parsed.pros ?? [],
            cons: parsed.cons ?? [],
            targetAudience: parsed.targetAudience ?? null,
            reviewCount,
          },
          update: {
            summary: parsed.summary ?? '요약 정보 없음',
            pros: parsed.pros ?? [],
            cons: parsed.cons ?? [],
            targetAudience: parsed.targetAudience ?? null,
            reviewCount,
            generatedAt: new Date(),
          },
        });
        return result;
      }
    } catch (e) {
      this.logger.error('AI 리뷰 요약 오류', e);
    }

    // 폴백: 별점 기반 단순 요약
    const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    return {
      placeId,
      summary: avgRating >= 4 ? '방문자들의 평가가 좋은 곳이에요.' : '다양한 평가가 있는 곳이에요.',
      pros: ['방문자 리뷰 기반 정보'],
      cons: [],
      targetAudience: null,
      reviewCount,
      generatedAt: new Date(),
    };
  }
}

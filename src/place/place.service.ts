import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from './kakao.service';
import { PlaceCategory as PrismaPlaceCategory } from '@prisma/client';
import type { Place } from './types/kakao.types';

@Injectable()
export class PlaceService {
  private readonly logger = new Logger(PlaceService.name);

  constructor(
    private prisma: PrismaService,
    private kakao: KakaoService,
  ) {}

  // ── 주변 장소 (카카오 우선) ─────────────────────────────────────────────────
  async getNearby(lat: number, lng: number, radiusKm = 3, page = 1) {
    const kakaoResults = await this.kakao.searchNearby(lat, lng, radiusKm * 1000, page);

    // 카카오 결과가 있으면 그대로 반환
    if (kakaoResults.length > 0) {
      return this.paginateKakao(kakaoResults, page);
    }

    // 폴백: DB 바운딩 박스 검색
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
      return this.paginateKakao(kakaoResults, page);
    }

    // 폴백: DB 텍스트 검색
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
  // kakao_ 접두사 ID → DB에 upsert 후 반환
  async getById(id: string) {
    if (id.startsWith('kakao_')) {
      await this.upsertKakaoPlace(id);
    }

    const place = await this.prisma.place.findUnique({
      where: { id },
      include: {
        images: true,
        tags: true,
        reviews: {
          include: { user: { select: { id: true, name: true } } },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!place) throw new NotFoundException('장소를 찾을 수 없어요.');
    return place;
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
      await this.prisma.bookmark.delete({ where: { userId_placeId: { userId, placeId } } });
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

  // ── 체크인 ─────────────────────────────────────────────────────────────────
  async checkIn(userId: string, placeId: string, mood: string, note?: string, imageUrl?: string) {
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
  private async upsertKakaoPlace(kakaoId: string, place?: Place): Promise<void> {
    try {
      // place 데이터가 없으면 키워드 검색으로 가져옴 (제한적)
      const data = place ?? await this.fetchKakaoPlaceById(kakaoId);
      if (!data) {
        this.logger.warn(`카카오 장소 조회 실패: ${kakaoId}`);
        return;
      }

      await this.prisma.place.upsert({
        where: { id: data.id },
        create: {
          id:          data.id,
          name:        data.name,
          category:    data.category as PrismaPlaceCategory,
          address:     data.address,
          lat:         data.lat,
          lng:         data.lng,
          phone:       data.phone ?? null,
          isActive:    true,
          tags: {
            create: data.tags
              .filter(Boolean)
              .map((tag) => ({ tag })),
          },
        },
        update: {
          name:     data.name,
          address:  data.address,
          lat:      data.lat,
          lng:      data.lng,
          phone:    data.phone ?? null,
          isActive: true,
        },
      });
    } catch (err) {
      this.logger.error(`카카오 place upsert 실패 (${kakaoId})`, err);
    }
  }

  // ── Private: kakao_xxx ID로 카카오 검색하여 Place 정보 복원 ─────────────────
  private async fetchKakaoPlaceById(kakaoPlaceId: string): Promise<Place | null> {
    // 카카오는 ID 기반 단건 조회 API 없음 → ID만으로는 복원 불가
    // 대신 DB에서 이미 저장된 레코드 확인
    const existing = await this.prisma.place.findUnique({
      where: { id: kakaoPlaceId },
      include: { tags: true },
    });
    if (!existing) return null;

    return {
      id:            existing.id,
      name:          existing.name,
      category:      existing.category as any,
      categoryLabel: existing.category,
      address:       existing.address,
      lat:           existing.lat,
      lng:           existing.lng,
      phone:         existing.phone ?? undefined,
      rating:        existing.rating,
      reviewCount:   existing.reviewCount,
      tags:          existing.tags.map((t) => t.tag),
    };
  }

  // ── Private: 카카오 결과를 페이지네이션 형식으로 래핑 ─────────────────────
  private paginateKakao(places: Place[], page: number) {
    return {
      data:    places,
      page,
      total:   places.length,
      hasNext: places.length === 15,
    };
  }
}

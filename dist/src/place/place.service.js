"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PlaceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const kakao_service_1 = require("./kakao.service");
let PlaceService = PlaceService_1 = class PlaceService {
    prisma;
    kakao;
    logger = new common_1.Logger(PlaceService_1.name);
    constructor(prisma, kakao) {
        this.prisma = prisma;
        this.kakao = kakao;
    }
    async getNearby(lat, lng, radiusKm = 3, page = 1) {
        const kakaoResults = await this.kakao.searchNearby(lat, lng, radiusKm * 1000, page);
        if (kakaoResults.length > 0) {
            return this.paginateKakao(kakaoResults, page);
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
    async search(query, lat, lng, page = 1) {
        const kakaoResults = await this.kakao.searchByKeyword(query, lat, lng, page);
        if (kakaoResults.length > 0) {
            return this.paginateKakao(kakaoResults, page);
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
    async getById(id) {
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
        if (!place)
            throw new common_1.NotFoundException('장소를 찾을 수 없어요.');
        return place;
    }
    async toggleBookmark(userId, placeId) {
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
    async getBookmarks(userId) {
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
    async checkIn(userId, placeId, mood, note, imageUrl) {
        if (placeId.startsWith('kakao_')) {
            await this.upsertKakaoPlace(placeId);
        }
        return this.prisma.checkIn.create({
            data: { userId, placeId, mood, note, imageUrl },
        });
    }
    async upsertKakaoPlaces(places) {
        await Promise.all(places.map((p) => this.upsertKakaoPlace(p.id, p)));
    }
    async upsertKakaoPlace(kakaoId, place) {
        try {
            const data = place ?? await this.fetchKakaoPlaceById(kakaoId);
            if (!data) {
                this.logger.warn(`카카오 장소 조회 실패: ${kakaoId}`);
                return;
            }
            await this.prisma.place.upsert({
                where: { id: data.id },
                create: {
                    id: data.id,
                    name: data.name,
                    category: data.category,
                    address: data.address,
                    lat: data.lat,
                    lng: data.lng,
                    phone: data.phone ?? null,
                    isActive: true,
                    tags: {
                        create: data.tags
                            .filter(Boolean)
                            .map((tag) => ({ tag })),
                    },
                },
                update: {
                    name: data.name,
                    address: data.address,
                    lat: data.lat,
                    lng: data.lng,
                    phone: data.phone ?? null,
                    isActive: true,
                },
            });
        }
        catch (err) {
            this.logger.error(`카카오 place upsert 실패 (${kakaoId})`, err);
        }
    }
    async fetchKakaoPlaceById(kakaoPlaceId) {
        const existing = await this.prisma.place.findUnique({
            where: { id: kakaoPlaceId },
            include: { tags: true },
        });
        if (!existing)
            return null;
        return {
            id: existing.id,
            name: existing.name,
            category: existing.category,
            categoryLabel: existing.category,
            address: existing.address,
            lat: existing.lat,
            lng: existing.lng,
            phone: existing.phone ?? undefined,
            rating: existing.rating,
            reviewCount: existing.reviewCount,
            tags: existing.tags.map((t) => t.tag),
        };
    }
    paginateKakao(places, page) {
        return {
            data: places,
            page,
            total: places.length,
            hasNext: places.length === 15,
        };
    }
};
exports.PlaceService = PlaceService;
exports.PlaceService = PlaceService = PlaceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        kakao_service_1.KakaoService])
], PlaceService);
//# sourceMappingURL=place.service.js.map
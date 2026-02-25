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
var KakaoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KakaoService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const CATEGORY_MAP = {
    CE7: 'CAFE',
    FD6: 'RESTAURANT',
    OL7: 'BAR',
    AT4: 'PARK',
    CT1: 'CULTURAL',
    BK9: 'BOOKSTORE',
};
const CATEGORY_LABEL = {
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
const CATEGORY_IMAGE = {
    CAFE: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80',
    RESTAURANT: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
    BAR: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=400&q=80',
    PARK: 'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=400&q=80',
    CULTURAL: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80',
    BOOKSTORE: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80',
    BOWLING: 'https://images.unsplash.com/photo-1567522838345-7e91be72fb0e?w=400&q=80',
    KARAOKE: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&q=80',
    SPA: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80',
    ETC: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&q=80',
};
let KakaoService = KakaoService_1 = class KakaoService {
    http;
    config;
    logger = new common_1.Logger(KakaoService_1.name);
    baseUrl = 'https://dapi.kakao.com/v2/local/search';
    constructor(http, config) {
        this.http = http;
        this.config = config;
    }
    get headers() {
        return {
            Authorization: `KakaoAK ${this.config.get('KAKAO_REST_API_KEY') ?? ''}`,
        };
    }
    async searchByKeyword(query, lat, lng, page = 1) {
        try {
            const params = { query, page, size: 15 };
            if (lat != null && lng != null) {
                params.x = lng;
                params.y = lat;
                params.sort = 'distance';
            }
            const { data } = await (0, rxjs_1.firstValueFrom)(this.http.get(`${this.baseUrl}/keyword.json`, {
                headers: this.headers,
                params,
            }));
            const places = [];
            for (const doc of data.documents) {
                places.push(this.toPlace(doc));
            }
            return places;
        }
        catch (err) {
            this.logger.error('카카오 키워드 검색 실패', err);
            return [];
        }
    }
    async searchNearby(lat, lng, radiusM = 3000, page = 1) {
        const categoryCodes = ['CE7', 'FD6', 'AT4', 'CT1', 'BK9', 'OL7'];
        const results = await Promise.allSettled(categoryCodes.map((code) => (0, rxjs_1.firstValueFrom)(this.http.get(`${this.baseUrl}/category.json`, {
            headers: this.headers,
            params: {
                category_group_code: code,
                x: lng,
                y: lat,
                radius: radiusM,
                sort: 'distance',
                size: 5,
                page,
            },
        })).then((res) => res.data.documents.map((doc) => this.toPlace(doc)))));
        const sets = results
            .filter((r) => r.status === 'fulfilled')
            .map((r) => r.value);
        const seen = new Set();
        const merged = [];
        const maxLen = Math.max(...sets.map((s) => s.length), 0);
        for (let i = 0; i < maxLen && merged.length < 15; i++) {
            for (const set of sets) {
                if (merged.length >= 15)
                    break;
                const place = set[i];
                if (place && !seen.has(place.id)) {
                    seen.add(place.id);
                    merged.push(place);
                }
            }
        }
        return merged;
    }
    toPlace(p) {
        const category = this.detectCategory(p.category_group_code, p.place_name);
        const categoryLabel = CATEGORY_LABEL[category] ?? '기타';
        const distanceM = p.distance != null && p.distance !== ''
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
            rating: 0,
            reviewCount: 0,
            tags: [p.category_group_name].filter(Boolean),
            distance: distanceM != null && !isNaN(distanceM)
                ? this.formatDistance(distanceM)
                : undefined,
            imageUrl: CATEGORY_IMAGE[category] ?? CATEGORY_IMAGE['ETC'],
            isSponsored: false,
        };
    }
    formatDistance(meters) {
        return meters < 1000
            ? `${meters.toString()}m`
            : `${(meters / 1000).toFixed(1)}km`;
    }
    detectCategory(code, name) {
        if (code && CATEGORY_MAP[code])
            return CATEGORY_MAP[code];
        const n = name;
        if (/노래방|코인노래|노래연습/.test(n))
            return 'KARAOKE';
        if (/볼링/.test(n))
            return 'BOWLING';
        if (/찜질|사우나|스파|온천|한증/.test(n))
            return 'SPA';
        if (/방탈출|이스케이프/.test(n))
            return 'ESCAPE';
        if (/오락실|게임센터|아케이드/.test(n))
            return 'ARCADE';
        if (/PC방|피씨방|컴퓨터/.test(n))
            return 'ETC';
        if (/공원|숲|산책/.test(n))
            return 'PARK';
        if (/갤러리|전시|미술관|박물관/.test(n))
            return 'CULTURAL';
        if (/서점|책방|도서관/.test(n))
            return 'BOOKSTORE';
        return 'ETC';
    }
};
exports.KakaoService = KakaoService;
exports.KakaoService = KakaoService = KakaoService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], KakaoService);
//# sourceMappingURL=kakao.service.js.map
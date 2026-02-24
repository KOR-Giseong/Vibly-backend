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
var GooglePlacesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GooglePlacesService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let GooglePlacesService = GooglePlacesService_1 = class GooglePlacesService {
    config;
    logger = new common_1.Logger(GooglePlacesService_1.name);
    baseUrl = 'https://places.googleapis.com/v1';
    constructor(config) {
        this.config = config;
    }
    get apiKey() {
        return this.config.get('GOOGLE_PLACES_API_KEY') ?? '';
    }
    async enrichPlaces(places) {
        if (!this.apiKey) {
            this.logger.warn('GOOGLE_PLACES_API_KEY 없음 → 보완 생략');
            return places;
        }
        const enriched = await Promise.all(places.map((place) => this.enrichOne(place)));
        return enriched;
    }
    async enrichOne(place) {
        try {
            const query = `${place.name} ${place.address}`;
            const result = await this.textSearch(query);
            if (!result)
                return place;
            const photoUrl = result.photos?.[0]
                ? this.buildPhotoUrl(result.photos[0].name)
                : undefined;
            return {
                ...place,
                imageUrl: photoUrl ?? place.imageUrl,
                rating: result.rating ?? place.rating,
                reviewCount: result.userRatingCount ?? place.reviewCount,
            };
        }
        catch (err) {
            this.logger.warn(`Google 보완 실패: ${place.name}`, err);
            return place;
        }
    }
    async textSearch(query) {
        const res = await fetch(`${this.baseUrl}/places:searchText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': this.apiKey,
                'X-Goog-FieldMask': 'places.id,places.rating,places.userRatingCount,places.photos',
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
        const data = (await res.json());
        return data.places?.[0] ?? null;
    }
    buildPhotoUrl(photoName) {
        return `${this.baseUrl}/${photoName}/media?maxWidthPx=400&key=${this.apiKey}`;
    }
};
exports.GooglePlacesService = GooglePlacesService;
exports.GooglePlacesService = GooglePlacesService = GooglePlacesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GooglePlacesService);
//# sourceMappingURL=google-places.service.js.map
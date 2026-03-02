import { ConfigService } from '@nestjs/config';
import type { Place } from './types/kakao.types';
export declare class KakaoService {
    private config;
    private readonly logger;
    private readonly baseUrl;
    private readonly apiKey;
    constructor(config: ConfigService);
    private kakaoFetch;
    searchByKeyword(query: string, lat?: number, lng?: number, page?: number, sort?: 'accuracy' | 'distance', limit?: number, radiusM?: number): Promise<Place[]>;
    searchNearby(lat: number, lng: number, radiusM?: number, page?: number, limit?: number): Promise<Place[]>;
    private toPlace;
    private formatDistance;
    private detectCategory;
}

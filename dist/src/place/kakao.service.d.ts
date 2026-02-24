import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import type { Place } from './types/kakao.types';
export declare class KakaoService {
    private http;
    private config;
    private readonly logger;
    private readonly baseUrl;
    constructor(http: HttpService, config: ConfigService);
    private get headers();
    searchByKeyword(query: string, lat?: number, lng?: number, page?: number): Promise<Place[]>;
    searchNearby(lat: number, lng: number, radiusM?: number, page?: number): Promise<Place[]>;
    private toPlace;
    private formatDistance;
    private detectCategory;
}

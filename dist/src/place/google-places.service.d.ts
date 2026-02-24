import { ConfigService } from '@nestjs/config';
import type { Place } from './types/kakao.types';
export declare class GooglePlacesService {
    private config;
    private readonly logger;
    private readonly baseUrl;
    constructor(config: ConfigService);
    private get apiKey();
    enrichPlaces(places: Place[]): Promise<Place[]>;
    private enrichOne;
    private textSearch;
    private buildPhotoUrl;
}

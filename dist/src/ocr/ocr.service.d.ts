import { ConfigService } from '@nestjs/config';
export declare class OcrService {
    private readonly config;
    private readonly logger;
    private readonly client;
    constructor(config: ConfigService);
    extractLines(imageBuffer: Buffer): Promise<string[]>;
}

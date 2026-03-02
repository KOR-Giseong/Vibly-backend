import { ConfigService } from '@nestjs/config';
export declare class R2Service {
    private config;
    private readonly logger;
    private readonly client;
    private readonly bucket;
    private readonly publicUrl;
    constructor(config: ConfigService);
    upload(buffer: Buffer, folder: string, ext: string, mimeType: string): Promise<string>;
    deleteByUrl(url: string): Promise<void>;
}

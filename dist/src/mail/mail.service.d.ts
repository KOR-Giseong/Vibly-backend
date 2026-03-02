import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private config;
    private readonly resend;
    private readonly logger;
    private readonly from;
    constructor(config: ConfigService);
    sendVerificationCode(to: string, code: string): Promise<void>;
}

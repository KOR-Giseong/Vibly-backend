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
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const resend_1 = require("resend");
let MailService = MailService_1 = class MailService {
    config;
    resend;
    logger = new common_1.Logger(MailService_1.name);
    from = 'Vibly <onboarding@resend.dev>';
    constructor(config) {
        this.config = config;
        const apiKey = this.config.get('RESEND_API_KEY') ?? 're_test';
        this.resend = new resend_1.Resend(apiKey);
    }
    async sendVerificationCode(to, code) {
        try {
            await this.resend.emails.send({
                from: this.from,
                to,
                subject: '[Vibly] 이메일 인증 코드',
                html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
            <h2 style="font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">
              이메일 인증
            </h2>
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 32px;">
              아래 6자리 인증 코드를 앱에 입력해 주세요.<br/>
              코드는 <strong>10분</strong> 후에 만료됩니다.
            </p>
            <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
              <span style="font-size: 40px; font-weight: 800; letter-spacing: 8px; color: #7c3aed;">
                ${code}
              </span>
            </div>
            <p style="color: #999; font-size: 13px;">
              본인이 요청하지 않은 경우 이 메일을 무시해 주세요.
            </p>
          </div>
        `,
            });
        }
        catch (err) {
            this.logger.error('이메일 발송 실패', err);
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map
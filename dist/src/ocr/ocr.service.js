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
var OcrService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const vision_1 = require("@google-cloud/vision");
let OcrService = OcrService_1 = class OcrService {
    config;
    logger = new common_1.Logger(OcrService_1.name);
    client;
    constructor(config) {
        this.config = config;
        const projectId = config.get('GOOGLE_CLOUD_PROJECT_ID');
        const clientEmail = config.get('GOOGLE_CLOUD_CLIENT_EMAIL');
        const privateKey = config
            .get('GOOGLE_CLOUD_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n');
        if (!projectId || !clientEmail || !privateKey) {
            this.logger.warn('Google Cloud Vision 환경변수가 설정되지 않았습니다. OCR 기능이 비활성화됩니다.');
        }
        this.client = new vision_1.ImageAnnotatorClient({
            credentials: { client_email: clientEmail, private_key: privateKey },
            projectId,
        });
    }
    async extractLines(imageBuffer) {
        const [result] = await this.client.textDetection({
            image: { content: imageBuffer.toString('base64') },
        });
        const annotations = result.textAnnotations ?? [];
        if (!annotations.length)
            return [];
        const fullText = annotations[0].description ?? '';
        return fullText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
    }
};
exports.OcrService = OcrService;
exports.OcrService = OcrService = OcrService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OcrService);
//# sourceMappingURL=ocr.service.js.map
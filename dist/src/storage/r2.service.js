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
var R2Service_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2Service = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = require("crypto");
let R2Service = R2Service_1 = class R2Service {
    config;
    logger = new common_1.Logger(R2Service_1.name);
    client;
    bucket;
    publicUrl;
    constructor(config) {
        this.config = config;
        const accountId = config.get('R2_ACCOUNT_ID');
        this.bucket = config.get('R2_BUCKET_NAME') ?? 'vibly-uploads';
        this.publicUrl = config.get('R2_PUBLIC_URL') ?? '';
        this.client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: config.get('R2_ACCESS_KEY_ID') ?? '',
                secretAccessKey: config.get('R2_SECRET_ACCESS_KEY') ?? '',
            },
        });
    }
    async upload(buffer, folder, ext, mimeType) {
        const key = `${folder}/${(0, crypto_1.randomUUID)()}.${ext}`;
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
        }));
        return `${this.publicUrl}/${key}`;
    }
    async deleteByUrl(url) {
        try {
            const key = url.replace(`${this.publicUrl}/`, '');
            if (!key || key === url)
                return;
            await this.client.send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        }
        catch (e) {
            this.logger.warn(`R2 파일 삭제 실패: ${url}`, e);
        }
    }
};
exports.R2Service = R2Service;
exports.R2Service = R2Service = R2Service_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], R2Service);
//# sourceMappingURL=r2.service.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, helmet_1.default)());
    const isProd = process.env.NODE_ENV === 'production';
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
        .split(',').map((o) => o.trim()).filter(Boolean);
    app.enableCors({ origin: isProd ? allowedOrigins : true, credentials: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Vibly API')
        .setDescription('감정 기반 장소 추천 서비스')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    swagger_1.SwaggerModule.setup('api/docs', app, swagger_1.SwaggerModule.createDocument(app, config));
    await app.listen(process.env.PORT ?? 3000);
    console.log(`🚀 Vibly API running on port ${process.env.PORT ?? 3000}`);
}
bootstrap();
//# sourceMappingURL=main.js.map
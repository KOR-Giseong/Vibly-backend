import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  // 개발: 전체 허용 / 프로덕션: ALLOWED_ORIGINS 환경변수로 제한
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: isProd ? allowedOrigins : true, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Vibly API')
    .setDescription('감정 기반 장소 추천 서비스')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Vibly API running on port ${process.env.PORT ?? 3000}`);
}
bootstrap();

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PlaceController } from './place.controller';
import { PlaceService } from './place.service';
import { KakaoService } from './kakao.service';
import { GooglePlacesService } from './google-places.service';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [
    HttpModule,
    OcrModule,
    // 영수증 이미지는 메모리에서만 처리 (디스크 저장 없음)
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 최대 10MB
    }),
  ],
  controllers: [PlaceController],
  providers: [PlaceService, KakaoService, GooglePlacesService],
  exports: [PlaceService, KakaoService, GooglePlacesService],
})
export class PlaceModule {}

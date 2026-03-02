import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PlaceController } from './place.controller';
import { PlaceService } from './place.service';
import { KakaoService } from './kakao.service';
import { GooglePlacesService } from './google-places.service';
import { OcrModule } from '../ocr/ocr.module';
import { CreditModule } from '../credit/credit.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    HttpModule,
    OcrModule,
    CreditModule,
    NotificationModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [PlaceController],
  providers: [PlaceService, KakaoService, GooglePlacesService],
  exports: [PlaceService, KakaoService, GooglePlacesService],
})
export class PlaceModule {}

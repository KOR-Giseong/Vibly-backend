import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlaceController } from './place.controller';
import { PlaceService } from './place.service';
import { KakaoService } from './kakao.service';
import { GooglePlacesService } from './google-places.service';

@Module({
  imports: [HttpModule],
  controllers: [PlaceController],
  providers: [PlaceService, KakaoService, GooglePlacesService],
  exports: [PlaceService, KakaoService, GooglePlacesService],
})
export class PlaceModule {}

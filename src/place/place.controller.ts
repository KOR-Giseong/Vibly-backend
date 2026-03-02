import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, Req, UseInterceptors, UploadedFile,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PlaceService } from './place.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CheckInDto } from './dto/checkin.dto';
import { AddReviewDto } from './dto/add-review.dto';

@ApiTags('Place')
@Controller('places')
export class PlaceController {
  constructor(private placeService: PlaceService) {}

  @Get('nearby')
  nearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.placeService.getNearby(
      +lat, +lng,
      +(radius ?? 2000),
      +(page ?? 1),
      +(limit ?? 20),
    );
  }

  @Get('search')
  search(
    @Query('query') query: string,   // 앱이 'query' 파라미터로 전송
    @Query('q') q: string,           // 웹/직접 호출용 호환
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const keyword = query || q;
    return this.placeService.search(
      keyword,
      lat ? +lat : undefined,
      lng ? +lng : undefined,
      +(page ?? 1),
      +(limit ?? 20),
    );
  }

  @Get('bookmarks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getBookmarks(@Req() req: any) {
    return this.placeService.getBookmarks(req.user.id);
  }

  @Get('my-checkins')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMyCheckins(@Req() req: any) {
    return this.placeService.getMyCheckins(req.user.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getById(
    @Req() req: any,
    @Param('id') id: string,
    @Query('name') name?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('mood') mood?: string,
    @Query('vibes') vibes?: string,
  ) {
    const hint = name && lat && lng
      ? { name, lat: +lat, lng: +lng }
      : undefined;
    const vibesArray = vibes ? vibes.split(',').filter(Boolean) : undefined;
    return this.placeService.getById(id, req.user?.id, hint, mood, vibesArray);
  }

  @Post(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  bookmark(@Req() req: any, @Param('id') id: string, @Body() body: { imageUrl?: string }) {
    return this.placeService.toggleBookmark(req.user.id, id, body?.imageUrl);
  }

  @Post(':id/checkin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('receipt'))
  async checkIn(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CheckInDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|webp|heic)$/ }),
        ],
        errorHttpStatusCode: 422,
        fileIsRequired: false, // 영수증 선택사항
      }),
    )
    receipt?: Express.Multer.File,
  ) {
    return this.placeService.checkInWithReceipt(
      req.user.id,
      id,
      receipt?.buffer ?? null,
      body.mood,
      body.note,
      body.lat,
      body.lng,
    );
  }

  @Get(':id/reviews')
  getReviews(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.placeService.getReviews(id, +(page ?? 1), +(limit ?? 20));
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  addReview(@Req() req: any, @Param('id') id: string, @Body() body: AddReviewDto) {
    return this.placeService.addReview(req.user.id, id, body.rating, body.body);
  }

  // AI 리뷰 요약 (프리미엄 전용)
  @Get(':id/review-summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getReviewSummary(@Req() req: any, @Param('id') id: string) {
    return this.placeService.getReviewSummary(id, req.user.id);
  }

  // 실시간 상황 기반 추천 (프리미엄 전용)
  @Post('smart-recommend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  smartRecommend(@Req() req: any, @Body() body: { lat: number; lng: number }) {
    return this.placeService.smartRecommend(req.user.id, body.lat, body.lng);
  }
}

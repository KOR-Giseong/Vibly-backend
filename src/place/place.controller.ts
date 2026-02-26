import { Controller, Get, Post, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
    @Query('page') page?: string,
  ) {
    console.log(`[nearby] lat=${lat} lng=${lng} radius=${radius}`);
    return this.placeService.getNearby(+lat, +lng, +(radius ?? 3000), +(page ?? 1));
  }

  @Get('search')
  search(
    @Query('query') query: string,   // 앱이 'query' 파라미터로 전송
    @Query('q') q: string,           // 웹/직접 호출용 호환
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('page') page?: string,
  ) {
    const keyword = query || q;
    return this.placeService.search(keyword, lat ? +lat : undefined, lng ? +lng : undefined, +(page ?? 1));
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
  ) {
    const hint = name && lat && lng
      ? { name, lat: +lat, lng: +lng }
      : undefined;
    return this.placeService.getById(id, req.user?.id, hint);
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
  checkIn(@Req() req: any, @Param('id') id: string, @Body() body: CheckInDto) {
    return this.placeService.checkIn(req.user.id, id, body.mood, body.note, body.imageUrl);
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
}

import { Controller, Get, Post, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PlaceService } from './place.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
    return this.placeService.getNearby(+lat, +lng, +(radius ?? 3), +(page ?? 1));
  }

  @Get('search')
  search(
    @Query('q') q: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('page') page?: string,
  ) {
    return this.placeService.search(q, lat ? +lat : undefined, lng ? +lng : undefined, +(page ?? 1));
  }

  @Get('bookmarks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getBookmarks(@Req() req: any) {
    return this.placeService.getBookmarks(req.user.id);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.placeService.getById(id);
  }

  @Post(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  bookmark(@Req() req: any, @Param('id') id: string) {
    return this.placeService.toggleBookmark(req.user.id, id);
  }

  @Post(':id/checkin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  checkIn(@Req() req: any, @Param('id') id: string, @Body() body: { mood: string; note?: string; imageUrl?: string }) {
    return this.placeService.checkIn(req.user.id, id, body.mood, body.note, body.imageUrl);
  }
}

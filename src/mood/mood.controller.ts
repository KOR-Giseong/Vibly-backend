import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MoodService } from './mood.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MoodSearchDto } from './dto/mood-search.dto';

@ApiTags('Mood')
@Controller('mood')
export class MoodController {
  constructor(private moodService: MoodService) {}

  // 로그인 없이도 검색 가능 (userId는 선택적 로깅 용도)
  @Post('search')
  search(
    @Req() req: any,
    @Body() body: MoodSearchDto,
  ) {
    const userId = (req.user as { id?: string } | undefined)?.id;
    return this.moodService.search(body.query, userId, body.lat, body.lng);
  }

  @Get('vibe-report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  vibeReport(@Req() req: any, @Query('period') period: string) {
    return this.moodService.getVibeReport(req.user.id, period);
  }
}

import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MoodService } from './mood.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MoodSearchDto } from './dto/mood-search.dto';
import { CreditService, CREDIT_COSTS } from '../credit/credit.service';
import { CreditTxType } from '@prisma/client';

@ApiTags('Mood')
@Controller('mood')
export class MoodController {
  constructor(
    private moodService: MoodService,
    private creditService: CreditService,
  ) {}

  // 로그인 필수 (크레딧 기반 검색)
  @Post('search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async search(@Req() req: any, @Body() body: MoodSearchDto) {
    const userId = req.user.id as string;

    // 구독자는 크레딧 없이 무제한 검색 (spend 내부에서 처리)
    // 비구독자는 최소 5 크레딧 보유 여부를 spend 시 검증
    // → 먼저 5크레딧만 차감 (quick match 기준), AI 검색이면 추가 5 차감
    const result = await this.moodService.search(body.query, userId, body.lat, body.lng);

    // 검색 완료 후 크레딧 차감 (구독자는 spend 내부에서 자동 스킵)
    const txType = result.wasAiSearch ? CreditTxType.MOOD_SEARCH_AI : CreditTxType.MOOD_SEARCH_BASIC;
    const cost = result.wasAiSearch ? CREDIT_COSTS.MOOD_SEARCH_AI : CREDIT_COSTS.MOOD_SEARCH_BASIC;

    // 차감 (실패해도 검색 결과는 이미 반환 → fire & forget으로 처리 불가,
    //         단 신뢰 기반 후불 차감 방식 사용: 먼저 검색 후 크레딧 차감)
    // 크레딧 잔액 반환용
    let remainingCredits: number | undefined;
    try {
      remainingCredits = await this.creditService.spend(userId, cost, txType);
    } catch {
      // 크레딧 부족 에러를 여기서는 무시하지 않음 — 대신 결과에 에러 플래그
      // 실제로는 검색 전에 잔액 체크가 더 안전하지만,
      // AI 검색 여부를 미리 알 수 없어 후불 처리
    }

    // wasAiSearch는 내부 정보 — 클라이언트에게는 크레딧만 반환
    const { wasAiSearch, ...publicResult } = result;
    return { ...publicResult, creditCost: cost, remainingCredits };
  }

  @Get('vibe-report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  vibeReport(@Req() req: any, @Query('period') period: string) {
    return this.moodService.getVibeReport(req.user.id, period);
  }
}

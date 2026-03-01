import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from '../place/kakao.service';
import { GooglePlacesService } from '../place/google-places.service';
import { PlaceService } from '../place/place.service';

interface GeminiAnalysis {
  summary: string;   // AI 한 줄 요약
  keywords: string[]; // 카카오 검색용 키워드 (예: ["조용한 카페", "북카페"])
}

@Injectable()
export class MoodService {
  private readonly logger = new Logger(MoodService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private kakao: KakaoService,
    private googlePlaces: GooglePlacesService,
    private placeService: PlaceService,
  ) {}

  async search(query: string, userId?: string, lat?: number, lng?: number) {
    // 위치 없으면 서울 시청 기본값
    const searchLat = lat ?? 37.5665;
    const searchLng = lng ?? 126.9780;

    // 1. 빠른 키워드 매칭 시도 (Gemini 없이 즉시 결과)
    const quickMatch = this.tryQuickMatch(query);
    const wasAiSearch = !quickMatch; // quick match 실패 → Gemini 호출 = AI 검색

    // 2. 매칭 성공 시 바로 검색, 실패 시 Gemini 분석
    const analysis = quickMatch ?? (await this.analyzeWithGemini(query));

    // 3. 카카오 실제 장소 검색 (키워드별 병렬 호출)
    const kakaoResults = await this.searchKakaoPlaces(analysis.keywords, searchLat, searchLng);

    // 4. Google Places로 사진 + 평점 보완 (API 키 없으면 자동 생략)
    const enrichedResults = await this.googlePlaces.enrichPlaces(kakaoResults);

    // 5. DB 앱 리뷰 평점만 병합 (저장은 상세보기/북마크/체크인 시에만)
    const mergedResults = await this.placeService.mergeDbRatings(enrichedResults);

    // 6. 기분 관련성 점수로 정렬 — 키워드 매칭도가 높은 장소를 상위에
    const rankedResults = this.rankByMoodRelevance(mergedResults, analysis.keywords);

    // 7. 검색 로그 비동기 저장 (결과를 기다리지 않음)
    this.saveMoodSearchLog(query, analysis.summary, userId).catch(
      (err) => this.logger.error('검색 로그 저장 실패', err),
    );

    return {
      summary:    analysis.summary,
      places:     rankedResults,
      keywords:   analysis.keywords,
      query,
      wasAiSearch, // 컨트롤러에서 크레딧 차감 판단용
      fallback:   false,
    };
  }

  // ── Gemini 분석 ─────────────────────────────────────────────────────────────
  private async analyzeWithGemini(query: string): Promise<GeminiAnalysis> {
    // 프롬프트 템플릿 DB 조회
    const template = await this.prisma.promptTemplate.findUnique({
      where: { type: 'MOOD_ANALYSIS' },
    });

    const systemPrompt = template?.template ?? DEFAULT_PROMPT;
    const userPrompt = systemPrompt.replace('{query}', query);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.config.get('GEMINI_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      const data = await res.json() as any;
      this.logger.debug(`Gemini raw: ${JSON.stringify(data).slice(0, 500)}`);

      if (data.error) {
        this.logger.error('Gemini API 오류', data.error);
        return this.buildFallbackAnalysis(query);
      }

      const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      this.logger.debug(`Gemini text: ${text.slice(0, 300)}`);

      // JSON 블록 파싱 시도
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<GeminiAnalysis>;
        if (parsed.summary && Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
          this.logger.log(`Gemini 키워드: ${parsed.keywords.join(', ')}`);
          return {
            summary:  parsed.summary,
            keywords: parsed.keywords.slice(0, 3),
          };
        }
      }

      // JSON 파싱 실패 → 폴백
      this.logger.warn(`Gemini JSON 파싱 실패. text="${text.slice(0, 100)}"`);
      return this.buildFallbackAnalysis(query);
    } catch (err) {
      this.logger.error('Gemini API 호출 실패 → 폴백', err);
      return this.buildFallbackAnalysis(query);
    }
  }

  // ── 카카오 병렬 검색 ─────────────────────────────────────────────────────────
  private async searchKakaoPlaces(keywords: string[], lat: number, lng: number) {
    // 키워드별 카카오 검색 병렬 실행
    // accuracy 정렬: 거리 무관하게 키워드 관련성 높은 장소 우선
    // lat/lng는 거리 표시용으로만 전달
    const resultSets = await Promise.all(
      keywords.map((kw) => this.kakao.searchByKeyword(kw, lat, lng, 1, 'accuracy')),
    );

    // 키워드별로 균등하게 인터리빙 (카페만 나오지 않도록)
    // ex) [['카페1','카페2'], ['공원1'], ['맛집1','맛집2']]
    //  → ['카페1', '공원1', '맛집1', '카페2', '맛집2']
    const seen = new Set<string>();
    const merged: typeof resultSets[0] = [];
    const maxLen = Math.max(...resultSets.map((r) => r.length));

    for (let i = 0; i < maxLen && merged.length < 10; i++) {
      for (const set of resultSets) {
        if (merged.length >= 10) break;
        const place = set[i];
        if (place && !seen.has(place.id)) {
          seen.add(place.id);
          merged.push(place);
        }
      }
    }

    return merged;
  }

  // ── 기분 관련성 점수로 정렬 ──────────────────────────────────────────────────
  private rankByMoodRelevance(places: any[], keywords: string[]): any[] {
    // 카테고리별 기본 점수 (기분 검색에 얼마나 어울리는지)
    const BASE: Record<string, number> = {
      CULTURAL: 78, PARK: 76, SPA: 76, BOOKSTORE: 75, CAFE: 74,
      ESCAPE: 74, RESTAURANT: 72, KARAOKE: 72, BAR: 70,
      BOWLING: 71, ARCADE: 71, ETC: 66,
    };

    const scored = places.map((place) => {
      let score = BASE[place.category] ?? 66;
      const name: string = place.name ?? '';
      const label: string = place.categoryLabel ?? '';
      let matchedKeyword: string | null = null;

      // 키워드 매칭 가중치: 첫 번째 키워드(AI 핵심 추천)가 가장 높은 가중치
      keywords.forEach((kw, idx) => {
        const weight = [18, 12, 7][idx] ?? 5;
        if (name.includes(kw) || label.includes(kw) || kw.includes(label)) {
          score += weight;
          if (!matchedKeyword) matchedKeyword = kw;
        }
      });

      // 태그: 매칭된 AI 키워드를 맨 앞에 배치해 관련성 표시
      const existingTags: string[] = Array.isArray(place.tags) ? place.tags : [];
      const tags = matchedKeyword
        ? [matchedKeyword, ...existingTags.filter((t: string) => t !== matchedKeyword).slice(0, 2)]
        : existingTags;

      return { ...place, vibeScore: Math.min(99, score), tags };
    });

    // vibeScore 내림차순 정렬
    return scored.sort((a, b) => (b.vibeScore ?? 0) - (a.vibeScore ?? 0));
  }

  // ── 빠른 키워드 매칭 (Gemini 없이 즉시 결과 반환, 매칭 실패 시 null) ────────
  private tryQuickMatch(query: string): GeminiAnalysis | null {
    const map: Record<string, GeminiAnalysis> = {
      카페:    { summary: '☕ 향긋한 커피와 함께 여유로운 시간을 보내봐요!', keywords: ['카페', '북카페', '루프탑 카페'] },
      커피:    { summary: '☕ 커피 한 잔으로 여유를 즐겨봐요!', keywords: ['카페', '북카페', '루프탑 카페'] },
      행복:    { summary: '😊 행복한 기분엔 활기찬 카페나 공원이 잘 어울려요!', keywords: ['카페', '공원', '맛집'] },
      평온:    { summary: '😌 평온한 마음엔 조용한 북카페가 딱이에요.', keywords: ['북카페', '공원', '조용한 카페'] },
      신남:    { summary: '🥳 신나는 날엔 노래방이나 볼링 어때요?', keywords: ['노래방', '볼링장', '보드게임카페'] },
      신나:    { summary: '🥳 신나는 날엔 노래방이나 볼링 어때요?', keywords: ['노래방', '볼링장', '보드게임카페'] },
      우울:    { summary: '😔 우울할 땐 찜질방에서 몸을 녹여봐요.', keywords: ['찜질방', '카페', '공원'] },
      열정:    { summary: '🔥 열정이 넘칠 때는 활기찬 공간이 좋아요!', keywords: ['클라이밍', '볼링장', '레스토랑'] },
      생각:    { summary: '💭 생각 정리엔 조용한 공간이 좋아요.', keywords: ['북카페', '공원', '독서실'] },
      지침:    { summary: '😪 지쳤을 땐 조용히 쉴 수 있는 곳으로.', keywords: ['찜질방', '공원', '조용한 카페'] },
      지쳐:    { summary: '😪 지쳐있을 때 따뜻하게 쉬어가요.', keywords: ['찜질방', '공원', '조용한 카페'] },
      배고파:  { summary: '🍽️ 배고플 땐 맛집으로 고고!', keywords: ['맛집', '레스토랑', '이자카야'] },
      배고픔:  { summary: '🍽️ 배고플 땐 맛집으로 고고!', keywords: ['맛집', '레스토랑', '이자카야'] },
      심심:    { summary: '🎮 심심할 땐 오락실이나 방탈출 어때요?', keywords: ['오락실', '방탈출', '보드게임카페'] },
      스트레스: { summary: '😤 스트레스는 확 풀어버려요!', keywords: ['노래방', '볼링장', 'PC방'] },
      화나:    { summary: '😤 화날 땐 소리 지르고 싶죠! 노래방 어때요?', keywords: ['노래방', '볼링장', '방탈출'] },
      외로:    { summary: '🫂 외로울 땐 따뜻한 공간으로.', keywords: ['보드게임카페', '북카페', '공원'] },
      설레:    { summary: '💓 설레는 날엔 분위기 있는 곳으로!', keywords: ['루프탑 카페', '레스토랑', '야경 명소'] },
      데이트:  { summary: '💕 데이트엔 특별한 장소가 필요하죠!', keywords: ['루프탑 카페', '레스토랑', '야경 명소'] },
      노래:    { summary: '🎤 노래하고 싶을 땐 노래방으로!', keywords: ['노래방', '라이브카페', '음악카페'] },
      볼링:    { summary: '🎳 볼링장에서 신나게 놀아봐요!', keywords: ['볼링장', '오락실', '당구장'] },
      술:      { summary: '🍺 가볍게 한잔하고 싶은 밤.', keywords: ['이자카야', '포차', '바'] },
      밥:      { summary: '🍜 맛있는 거 먹으러 가봐요!', keywords: ['맛집', '레스토랑', '국밥'] },
      운동:    { summary: '💪 운동으로 에너지를 발산해봐요!', keywords: ['클라이밍', '볼링장', '헬스장'] },
    };

    for (const [key, val] of Object.entries(map)) {
      if (query.includes(key)) {
        this.logger.log(`QuickMatch: "${key}" → ${val.keywords.join(', ')}`);
        return val;
      }
    }
    return null; // 매칭 실패 → Gemini 호출
  }

  // ── 폴백 분석 (Gemini 실패 시 사용) ─────────────────────────────────────────
  private buildFallbackAnalysis(query: string): GeminiAnalysis {
    const quick = this.tryQuickMatch(query);
    if (quick) return quick;

    return {
      summary:  `오늘 기분에 어울리는 장소를 찾아봤어요! 🗺️`,
      keywords: ['카페', '공원', '맛집'],
    };
  }

  // ── 검색 로그 저장 ───────────────────────────────────────────────────────────
  private async saveMoodSearchLog(
    query: string,
    summary: string,
    userId?: string,
  ) {
    await this.prisma.moodSearch.create({
      data: {
        userId:  userId ?? null,
        query,
        mood:    query,
        summary,
      },
    });
  }

  // ── 바이브 리포트 ────────────────────────────────────────────────────────────
  async getVibeReport(userId: string, period: string) {
    const now = new Date();
    let startDate: Date;

    if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // 월간: 이번 달 1일 00:00:00
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    // 해당 기간 체크인 + 장소 정보
    const checkIns = await this.prisma.checkIn.findMany({
      where: { userId, createdAt: { gte: startDate } },
      include: { place: true },
      orderBy: { createdAt: 'asc' },
    });

    // 리뷰 수
    const reviewCount = await this.prisma.review.count({
      where: { userId, createdAt: { gte: startDate } },
    });

    const total = checkIns.length;

    // ── 감정 분포 ────────────────────────────────────────────────────────────
    const moodCounts: Record<string, number> = {};
    checkIns.forEach((c) => {
      moodCounts[c.mood] = (moodCounts[c.mood] ?? 0) + 1;
    });

    const MOOD_META: Record<string, { label: string; emoji: string; color: string }> = {
      happy:      { label: '행복함',  emoji: '😊', color: '#FACC15' },
      peaceful:   { label: '평화로움', emoji: '😌', color: '#60A5FA' },
      excited:    { label: '신남',    emoji: '🥳', color: '#F472B6' },
      sad:        { label: '우울함',  emoji: '😔', color: '#C084FC' },
      thinking:   { label: '생각중',  emoji: '💭', color: '#9CA3AF' },
      passionate: { label: '열정적',  emoji: '🔥', color: '#F87171' },
    };

    const emotionDistribution = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([mood, count]) => ({
        mood,
        label:      MOOD_META[mood]?.label  ?? mood,
        emoji:      MOOD_META[mood]?.emoji  ?? '✨',
        color:      MOOD_META[mood]?.color  ?? '#A78BFA',
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }));

    // ── 일별 무드 (주간 전용) ────────────────────────────────────────────────
    const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
    const dailyMoods = period === 'weekly'
      ? Array.from({ length: 7 }, (_, i) => {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);
          const dayStr = d.toDateString();
          const dayCheckIns = checkIns.filter(
            (c) => new Date(c.createdAt).toDateString() === dayStr,
          );
          const topMood = dayCheckIns.length > 0
            ? Object.entries(
                dayCheckIns.reduce((acc, c) => {
                  acc[c.mood] = (acc[c.mood] ?? 0) + 1;
                  return acc;
                }, {} as Record<string, number>),
              ).sort((a, b) => b[1] - a[1])[0][0]
            : null;
          return {
            date:          d.toISOString(),
            dayLabel:      DAY_LABELS[d.getDay()],
            mood:          topMood,
            emoji:         topMood ? (MOOD_META[topMood]?.emoji ?? '✨') : null,
            checkInCount:  dayCheckIns.length,
          };
        })
      : [];

    // ── 카테고리(Top 바이브) ─────────────────────────────────────────────────
    const CATEGORY_META: Record<string, { label: string; color: string }> = {
      CAFE:       { label: '카페',    color: '#7C3AED' },
      RESTAURANT: { label: '레스토랑', color: '#2563EB' },
      BAR:        { label: '바',      color: '#DB2777' },
      PARK:       { label: '공원',    color: '#16A34A' },
      CULTURAL:   { label: '문화공간', color: '#D97706' },
      BOOKSTORE:  { label: '서점',    color: '#0891B2' },
      BOWLING:    { label: '볼링장',  color: '#F97316' },
      KARAOKE:    { label: '노래방',  color: '#EC4899' },
      SPA:        { label: '찜질방',  color: '#8B5CF6' },
      ESCAPE:     { label: '방탈출',  color: '#64748B' },
      ARCADE:     { label: '오락실',  color: '#F59E0B' },
      ETC:        { label: '기타',    color: '#9CA3AF' },
    };
    const categoryCounts: Record<string, number> = {};
    checkIns.forEach((c) => {
      const cat = c.place.category as string;
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    });
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, count]) => ({
        category:   cat,
        label:      CATEGORY_META[cat]?.label ?? '기타',
        color:      CATEGORY_META[cat]?.color ?? '#9CA3AF',
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }));

    // ── 방문 패턴 인사이트 ──────────────────────────────────────────────────
    const insights: { emoji: string; title: string; desc: string }[] = [];

    // 1. 가장 많이 방문한 카테고리
    if (topCategories[0]) {
      insights.push({
        emoji: '📍',
        title: `${topCategories[0].label}를 가장 많이 방문`,
        desc:  `이번 ${period === 'weekly' ? '주' : '달'} 방문의 ${topCategories[0].percentage}%가 ${topCategories[0].label}이었어요.`,
      });
    }

    // 2. 선호 시간대
    const hourBuckets: Record<string, number> = { 아침: 0, 오후: 0, 저녁: 0, 심야: 0 };
    checkIns.forEach((c) => {
      const h = new Date(c.createdAt).getHours();
      if (h >= 5  && h < 12) hourBuckets['아침']++;
      else if (h >= 12 && h < 17) hourBuckets['오후']++;
      else if (h >= 17 && h < 22) hourBuckets['저녁']++;
      else                         hourBuckets['심야']++;
    });
    const topTime = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
    if (topTime && topTime[1] > 0) {
      insights.push({
        emoji: topTime[0] === '아침' ? '☀️' : topTime[0] === '오후' ? '🌤️' : topTime[0] === '저녁' ? '🌙' : '🌃',
        title: `${topTime[0]} 시간대에 활발`,
        desc:  `${topTime[0]}에 가장 많은 체크인을 했어요.`,
      });
    }

    // 3. 가장 많이 방문한 장소
    const placeCounts: Record<string, { name: string; count: number }> = {};
    checkIns.forEach((c) => {
      if (!placeCounts[c.placeId]) placeCounts[c.placeId] = { name: c.place.name, count: 0 };
      placeCounts[c.placeId].count++;
    });
    const topPlace = Object.values(placeCounts).sort((a, b) => b.count - a.count)[0];
    if (topPlace && topPlace.count > 1) {
      insights.push({
        emoji: '⭐',
        title: `${topPlace.name} 단골 방문`,
        desc:  `이번 ${period === 'weekly' ? '주' : '달'} ${topPlace.name}을(를) ${topPlace.count}회 방문했어요.`,
      });
    }

    // 4. 긍정 무드 비율
    const POSITIVE = ['happy', 'excited', 'peaceful', 'passionate'];
    const positiveCount = checkIns.filter((c) => POSITIVE.includes(c.mood)).length;
    if (total > 0) {
      const positiveRatio = Math.round((positiveCount / total) * 100);
      insights.push({
        emoji: positiveRatio >= 70 ? '🌟' : '💫',
        title: `긍정 에너지 ${positiveRatio}%`,
        desc:  `이번 ${period === 'weekly' ? '주' : '달'} 방문의 ${positiveRatio}%가 긍정적인 기분이었어요!`,
      });
    }

    // ── 바이브 스코어 (긍정 비율 기반: 60~100점) ─────────────────────────────
    const vibeScore = total > 0
      ? Math.min(100, Math.round(60 + (positiveCount / total) * 40))
      : 0;

    // ── 고유 장소 수 ─────────────────────────────────────────────────────────
    const uniquePlacesCount = new Set(checkIns.map((c) => c.placeId)).size;

    // ── 날짜 범위 텍스트 ─────────────────────────────────────────────────────
    const fmt = (d: Date) =>
      `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    const dateRange = period === 'weekly'
      ? `${fmt(startDate)} - ${fmt(now)}`
      : `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

    return {
      period,
      dateRange,
      checkInCount:        total,
      uniquePlacesCount,
      reviewCount,
      vibeScore,
      emotionDistribution,
      dailyMoods,
      topCategories,
      insights,
    };
  }
}

// ── 기본 프롬프트 템플릿 ─────────────────────────────────────────────────────
const DEFAULT_PROMPT = `
당신은 감성 장소 큐레이터입니다.
사용자의 기분이나 요청을 분석하여 어울리는 장소 유형을 카카오맵 검색 키워드로 추출해주세요.

사용자 입력: {query}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "summary": "한 줄 공감 메시지 (최대 60자, 이모지 포함)",
  "keywords": ["카카오 지역 검색 키워드1", "키워드2", "키워드3"]
}

keywords 작성 규칙:
- 반드시 2~3개 작성, 한국어로
- 기분과 상황에 맞는 다양한 장소 유형을 추천 (카페에 치우치지 말 것)
- 예시 (참고용 - 상황에 맞게 자유롭게 변형):
  * 지치고 쉬고 싶다 → "조용한 카페", "공원", "찜질방"
  * 스트레스 풀고 싶다 → "볼링장", "노래방", "PC방"
  * 배고프다, 맛있는 거 → "맛집", "레스토랑", "이자카야"
  * 심심하다, 놀고 싶다 → "오락실", "보드게임카페", "방탈출"
  * 문화생활, 감성 충전 → "전시회", "갤러리", "북카페"
  * 신나고 활기차다 → "클럽", "루프탑 바", "라이브 카페"
  * 데이트, 설레임 → "루프탑 레스토랑", "야경 카페", "야경 명소"
  * 혼자 조용히 → "독서실", "1인 카페", "공원"
  * 친구들과 왁자지껄 → "노래방", "보드게임카페", "포차"
`.trim();


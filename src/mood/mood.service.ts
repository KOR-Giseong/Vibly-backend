import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoService } from '../place/kakao.service';
import { GooglePlacesService } from '../place/google-places.service';
import { PlaceService } from '../place/place.service';
import { CreditService } from '../credit/credit.service';

interface GeminiAnalysis {
  summary: string;    // AI 한 줄 요약
  keywords: string[]; // 카카오 검색용 키워드 (예: ["합정동 레스토랑", "합정 분위기 좋은 카페"])
  location?: string;  // 감지된 읍/면/동 또는 동네명 (예: "합정", "이태원")
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
    private creditService: CreditService,
  ) {}

  async search(query: string, userId?: string, lat?: number, lng?: number, limit = 20, radius?: number, regionLabel?: string) {
    // 프리미엄 여부 + 사용자 선호 바이브 병렬 조회
    const [subscribed, userRecord] = await Promise.all([
      userId ? this.creditService.isSubscribed(userId) : Promise.resolve(false),
      userId ? this.prisma.user.findUnique({ where: { id: userId }, select: { preferredVibes: true } }) : Promise.resolve(null),
    ]);
    const preferredVibes: string[] = (userRecord as any)?.preferredVibes ?? [];

    // 무료: limit ≤ 15, radius ≤ 3000m / 프리미엄: limit ≤ 15, radius ≤ 10000m
    // 카카오 API size 최대 15 → 여러 키워드 병렬 호출로 보완
    const maxLimit  = 15;
    const maxRadius = subscribed ? 10000 : 3000;
    const safeLimit  = Math.min(limit ?? 20, maxLimit);
    const safeRadius = radius != null ? Math.min(radius, maxRadius) : undefined;

    // 위치 없으면 서울 시청 기본값
    const searchLat = lat ?? 37.5665;
    const searchLng = lng ?? 126.9780;

    // 1. 빠른 키워드 매칭 시도 (Gemini 없이 즉시 결과)
    const quickMatch = this.tryQuickMatch(query, regionLabel);
    const wasAiSearch = !quickMatch; // quick match 실패 → Gemini 호출 = AI 검색

    // 2. 매칭 성공 시 바로 검색, 실패 시 Gemini 분석
    const analysis = quickMatch ?? (await this.analyzeWithGemini(query, regionLabel));

    // 3. 카카오 실제 장소 검색 (키워드별 병렬 호출)
    const kakaoResults = await this.searchKakaoPlaces(analysis.keywords, searchLat, searchLng, safeLimit, safeRadius);

    // 4. Google Places로 사진 + 평점 보완 (API 키 없으면 자동 생략)
    const enrichedResults = await this.googlePlaces.enrichPlaces(kakaoResults);

    // 5. DB 앱 리뷰 평점만 병합 (저장은 상세보기/북마크/체크인 시에만)
    const mergedResults = await this.placeService.mergeDbRatings(enrichedResults);

    // 6. 기분 관련성 점수로 정렬 — 키워드 매칭도 + 선호 바이브 호환성 반영
    const rankedResults = this.rankByMoodRelevance(mergedResults, analysis.keywords, preferredVibes);

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
  private async analyzeWithGemini(query: string, regionLabel?: string): Promise<GeminiAnalysis> {
    // 프롬프트 템플릿 DB 조회
    const template = await this.prisma.promptTemplate.findUnique({
      where: { type: 'MOOD_ANALYSIS' },
    });

    const systemPrompt = template?.template ?? DEFAULT_PROMPT;
    const region = regionLabel && regionLabel !== '내 위치' && regionLabel !== '전체'
      ? regionLabel
      : '근처';
    const userPrompt = systemPrompt
      .replace('{query}', query)
      .replace('{region}', region);

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
          const location = typeof parsed.location === 'string' && parsed.location ? parsed.location : undefined;
          const keywords = parsed.keywords.slice(0, 3);
          this.logger.log(`Gemini 키워드: ${keywords.join(', ')}${location ? ` (위치: ${location})` : ''}`);
          return {
            summary:  parsed.summary,
            keywords,
            location,
          };
        }
      }

      // JSON 파싱 실패 → 폴백
      this.logger.warn(`Gemini JSON 파싱 실패. text="${text.slice(0, 100)}"`);
      return this.buildFallbackAnalysis(query, regionLabel);
    } catch (err) {
      this.logger.error('Gemini API 호출 실패 → 폴백', err);
      return this.buildFallbackAnalysis(query, regionLabel);
    }
  }

  // ── 카카오 병렬 검색 ─────────────────────────────────────────────────────────
  private async searchKakaoPlaces(keywords: string[], lat: number, lng: number, limit: number, radius?: number) {
    // 키워드별 카카오 검색 병렬 실행
    // accuracy 정렬: 거리 무관하게 키워드 관련성 높은 장소 우선
    // lat/lng는 거리 표시용으로만 전달
    const resultSets = await Promise.all(
      keywords.map((kw) => this.kakao.searchByKeyword(kw, lat, lng, 1, 'accuracy', limit, radius)),
    );

    // 키워드별로 균등하게 인터리빙 (카페만 나오지 않도록)
    // ex) [['카페1','카페2'], ['공원1'], ['맛집1','맛집2']]
    //  → ['카페1', '공원1', '맛집1', '카페2', '맛집2']
    const seen = new Set<string>();
    const merged: typeof resultSets[0] = [];
    const maxLen = Math.max(...resultSets.map((r) => r.length));

    for (let i = 0; i < maxLen && merged.length < limit; i++) {
      for (const set of resultSets) {
        if (merged.length >= limit) break;
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
  // 선호 바이브-카테고리 호환성 맵
  private static readonly VIBE_CATEGORY_COMPAT: Record<string, string[]> = {
    '트렌디한':    ['CAFE', 'BAR', 'RESTAURANT', 'CULTURAL'],
    '힙한':        ['CAFE', 'BAR', 'RESTAURANT', 'CULTURAL'],
    '감성적':      ['CAFE', 'BAR', 'CULTURAL', 'BOOKSTORE'],
    '감성 충전':   ['CAFE', 'BAR', 'CULTURAL', 'BOOKSTORE'],
    '아늑한':      ['CAFE', 'BOOKSTORE', 'SPA', 'RESTAURANT'],
    '조용한':      ['CAFE', 'BOOKSTORE', 'PARK'],
    '힐링':        ['SPA', 'PARK', 'CAFE', 'BOOKSTORE'],
    '자연 친화':   ['PARK', 'CAFE'],
    '신나는':      ['KARAOKE', 'BOWLING', 'ARCADE', 'ESCAPE', 'BAR'],
    '활기찬':      ['KARAOKE', 'BOWLING', 'ARCADE', 'RESTAURANT', 'BAR'],
    '분위기 있는': ['BAR', 'RESTAURANT', 'CAFE', 'CULTURAL'],
    '고급스러운':  ['RESTAURANT', 'BAR', 'SPA'],
    '럭셔리':      ['RESTAURANT', 'BAR', 'SPA'],
    '독특한':      ['CULTURAL', 'ESCAPE', 'BOOKSTORE', 'ETC'],
    '예술적':      ['CULTURAL', 'BOOKSTORE', 'CAFE'],
    '낭만적':      ['CAFE', 'BAR', 'RESTAURANT'],
    '데이트':      ['CAFE', 'BAR', 'RESTAURANT', 'CULTURAL'],
  };

  private rankByMoodRelevance(places: any[], keywords: string[], preferredVibes: string[] = []): any[] {
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

      // 선호 바이브 카테고리 호환 시 보너스 점수 (+5)
      if (preferredVibes.length > 0 && place.category) {
        const hasCompatibleVibe = preferredVibes.some((vibe) => {
          const allowed = MoodService.VIBE_CATEGORY_COMPAT[vibe];
          return !allowed || allowed.includes(place.category as string);
        });
        if (hasCompatibleVibe) score += 5;
      }

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

  // ── 쿼리에서 위치명 감지 ─────────────────────────────────────────────────────
  private static readonly LOCATION_NAMES: string[] = [
    // ── 서울 구 단위 ──────────────────────────────────────────────────────────
    '노원구','마포구','강남구','서초구','송파구','관악구','동작구','영등포구','구로구','금천구',
    '양천구','강서구','은평구','서대문구','용산구','중구','종로구','성북구','강북구','도봉구',
    '중랑구','성동구','광진구','동대문구','강동구',
    // ── 서울 동네/상권 단위 ───────────────────────────────────────────────────
    '합정','홍대','이태원','신촌','성수','건대','혜화','명동','잠실','판교','여의도','압구정',
    '청담','삼성','역삼','선릉','논현','신사','가로수길','인사동','연남','상수','망원',
    '공덕','왕십리','뚝섬','한남','경리단길','해방촌','상계','창동','방학','쌍문',
    '을지로','익선동','낙원동','충무로','동대문',
    '노원','마포','강남','서초','송파','관악','강서','은평','종로','성북',
    // ── 인천 ─────────────────────────────────────────────────────────────────
    '인천','부평','계양','남동구','연수구','미추홀구','서구','동구','중구','강화','송도','청라',
    // ── 경기도 ───────────────────────────────────────────────────────────────
    '수원','성남','분당','판교','위례','하남','구리','일산','부천','안양','안산','화성','평택',
    '용인','기흥','수지','광주','이천','여주','파주','김포','광명','시흥','오산','의왕','군포',
    '남양주','의정부','양주','동두천','포천','가평','양평','연천','과천',
    // ── 강원도 ───────────────────────────────────────────────────────────────
    '춘천','원주','강릉','속초','태백','삼척','동해','홍천','횡성','영월','평창','정선',
    '철원','화천','양구','인제','고성','양양','강원',
    // ── 충청북도 ─────────────────────────────────────────────────────────────
    '청주','충주','제천','보은','옥천','영동','증평','진천','괴산','음성','단양','충북',
    // ── 충청남도 ─────────────────────────────────────────────────────────────
    '천안','공주','보령','아산','서산','논산','계룡','당진','금산','부여','서천','청양',
    '홍성','예산','태안','충남',
    // ── 대전 / 세종 ──────────────────────────────────────────────────────────
    '대전','유성','세종',
    // ── 전라북도 ─────────────────────────────────────────────────────────────
    '전주','군산','익산','정읍','남원','김제','완주','진안','무주','장수','임실','순창',
    '고창','부안','전북',
    // ── 전라남도 ─────────────────────────────────────────────────────────────
    '목포','여수','순천','나주','광양','담양','곡성','구례','고흥','보성','화순','장흥',
    '강진','해남','영암','무안','함평','영광','장성','완도','진도','신안','전남',
    // ── 광주 ─────────────────────────────────────────────────────────────────
    '광주','북구','광산구',
    // ── 경상북도 ─────────────────────────────────────────────────────────────
    '포항','경주','구미','영주','영천','상주','문경','경산','군위','의성','청송','영양',
    '영덕','청도','고령','성주','칠곡','예천','봉화','울진','울릉','경북',
    // ── 경상남도 ─────────────────────────────────────────────────────────────
    '창원','진주','통영','사천','김해','밀양','거제','양산','의령','함안','창녕','고성',
    '남해','하동','산청','함양','거창','합천','경남',
    // ── 대구 / 울산 / 부산 ────────────────────────────────────────────────────
    '대구','수성구','달서구','달성군','울산','남구','북구',
    '부산','해운대','광안리','서면','남포동','기장','동래','사하','사상','연제','금정',
    // ── 제주 ─────────────────────────────────────────────────────────────────
    '제주','제주시','서귀포','성산','애월','한림','협재','중문',
  ];

  private detectLocation(query: string): string | null {
    for (const loc of MoodService.LOCATION_NAMES) {
      if (query.includes(loc)) return loc;
    }
    return null;
  }

  // ── 빠른 키워드 매칭 (Gemini 없이 즉시 결과 반환, 매칭 실패 시 null) ────────
  private tryQuickMatch(query: string, regionLabel?: string): GeminiAnalysis | null {
    const region = regionLabel && regionLabel !== '내 위치' && regionLabel !== '전체'
      ? regionLabel
      : null;
    const suffix = region ? ` ${region}에서 딱 맞는 곳을 찾아봤어요!` : ' 지금 딱 어울리는 곳을 찾아봤어요!';

    // 쿼리에서 위치명 감지 → 키워드에 prefix 추가
    // 을지로는 1가가 종각 옆이라 카카오가 종각 결과를 섞으므로 3가로 매핑
    const LOCATION_REMAP: Record<string, string> = { '을지로': '을지로3가' };
    const detectedLocation = this.detectLocation(query);
    const mappedLocation = detectedLocation ? (LOCATION_REMAP[detectedLocation] ?? detectedLocation) : null;
    const locPrefix = mappedLocation ? `${mappedLocation} ` : '';

    const map: Record<string, { summary: string; keywords: string[] }> = {
      // ── 카페/커피 ──────────────────────────────────────────────────────────
      카페:      { summary: `☕ 카페에서 여유로운 시간을 보내고 싶군요!${suffix}`, keywords: ['감성 카페', '북카페', '브런치 카페'] },
      커피:      { summary: `☕ 커피 한 잔으로 여유를 즐기고 싶군요!${suffix}`, keywords: ['스페셜티 카페', '핸드드립 카페', '감성 카페'] },
      브런치:    { summary: `🥞 여유로운 브런치 타임이 필요하군요!${suffix}`, keywords: ['브런치 카페', '브런치 레스토랑', '에그 브런치'] },
      디저트:    { summary: `🍰 달콤한 디저트로 기분 전환해봐요!${suffix}`, keywords: ['디저트 카페', '케이크 카페', '마카롱 카페'] },
      빵:        { summary: `🥐 갓 구운 빵 향기가 그리운 날이군요!${suffix}`, keywords: ['베이커리', '빵집 카페', '크루아상 맛집'] },
      베이커리:  { summary: `🥖 근사한 베이커리 카페를 찾고 계시는군요!${suffix}`, keywords: ['베이커리 카페', '빵집', '소금빵 맛집'] },
      타르트:    { summary: `🍮 달콤한 타르트가 생각나는 날이네요!${suffix}`, keywords: ['타르트 카페', '디저트 카페', '마카롱 카페'] },
      아이스크림: { summary: `🍦 달달한 아이스크림이 생각나는군요!${suffix}`, keywords: ['아이스크림 카페', '젤라토', '디저트 카페'] },
      빙수:      { summary: `🍧 시원한 빙수 한 그릇으로 더위를 날려봐요!${suffix}`, keywords: ['빙수 카페', '팥빙수 맛집', '디저트 카페'] },
      와플:      { summary: `🧇 바삭한 와플이 땡기는 날이군요!${suffix}`, keywords: ['와플 카페', '디저트 카페', '브런치 카페'] },
      케이크:    { summary: `🎂 달콤한 케이크가 생각나는 날이에요!${suffix}`, keywords: ['케이크 카페', '디저트 카페', '베이커리 카페'] },
      마카롱:    { summary: `🫐 귀엽고 달콤한 마카롱이 생각나는 날이군요!${suffix}`, keywords: ['마카롱 카페', '디저트 카페', '케이크 카페'] },
      초콜릿:    { summary: `🍫 달콤한 초콜릿 디저트가 생각나는 날이에요!${suffix}`, keywords: ['초콜릿 카페', '디저트 카페', '케이크 카페'] },
      한옥카페:  { summary: `🏯 고즈넉한 한옥카페에서 여유를 즐기고 싶군요!${suffix}`, keywords: ['한옥카페', '전통 카페', '감성 카페'] },
      테라스:    { summary: `🌿 탁 트인 테라스에서 여유를 즐기고 싶군요!${suffix}`, keywords: ['테라스 카페', '루프탑 카페', '야외 카페'] },
      식물:      { summary: `🌱 초록 식물이 가득한 카페에서 힐링하고 싶군요!${suffix}`, keywords: ['식물 카페', '가든 카페', '감성 카페'] },

      // ── 음료 ────────────────────────────────────────────────────────────────
      주스:      { summary: `🧃 신선한 주스로 건강하게 기분 전환해봐요!${suffix}`, keywords: ['주스 바', '착즙 주스', '과일 카페'] },
      스무디:    { summary: `🥤 상큼한 스무디가 생각나는 날이군요!${suffix}`, keywords: ['스무디 카페', '주스 바', '과일 카페'] },
      버블티:    { summary: `🧋 쫀득한 버블티가 마시고 싶은 날이군요!${suffix}`, keywords: ['버블티 카페', '타피오카 카페', '밀크티 카페'] },
      밀크티:    { summary: `🍵 부드러운 밀크티가 생각나는 날이군요!${suffix}`, keywords: ['밀크티 카페', '버블티 카페', '티 카페'] },
      차:        { summary: `🍵 향긋한 차 한 잔으로 마음을 달래고 싶군요!${suffix}`, keywords: ['티 카페', '전통 찻집', '북카페'] },
      라떼:      { summary: `☕ 부드러운 라떼 한 잔이 생각나는 날이군요!${suffix}`, keywords: ['스페셜티 카페', '감성 카페', '브런치 카페'] },

      // ── 날씨/계절 ────────────────────────────────────────────────────────────
      비:        { summary: `🌧️ 비 오는 날엔 아늑한 실내 공간이 딱이에요!${suffix}`, keywords: ['아늑한 카페', '북카페', '브런치 레스토랑'] },
      비오는:    { summary: `🌧️ 비 오는 날 어울리는 감성 가득한 곳을 찾아봤어요!${suffix}`, keywords: ['감성 카페', '북카페', '아늑한 레스토랑'] },
      봄:        { summary: `🌸 봄 나들이에 딱 맞는 장소를 찾아봤어요!${suffix}`, keywords: ['벚꽃 명소', '공원', '테라스 카페'] },
      여름:      { summary: `☀️ 여름을 시원하게 즐길 수 있는 곳을 찾아봤어요!${suffix}`, keywords: ['루프탑 카페', '수영장 카페', '빙수 카페'] },
      가을:      { summary: `🍂 가을 감성 가득한 곳을 찾아봤어요!${suffix}`, keywords: ['단풍 명소', '공원', '감성 카페'] },
      겨울:      { summary: `❄️ 따뜻하게 겨울을 즐길 수 있는 곳을 찾아봤어요!${suffix}`, keywords: ['아늑한 카페', '찜질방', '핫초코 카페'] },
      더워:      { summary: `🥵 더운 날엔 시원하게 즐길 수 있는 곳이 필요해요!${suffix}`, keywords: ['빙수 카페', '아이스크림 카페', '실내 카페'] },
      추워:      { summary: `🥶 추운 날엔 따뜻하게 몸을 녹일 수 있는 곳이 딱이에요!${suffix}`, keywords: ['아늑한 카페', '찜질방', '브런치 레스토랑'] },

      // ── 감정/기분 ──────────────────────────────────────────────────────────
      행복:      { summary: `😊 행복한 기분이네요! 활기찬 분위기가 잘 어울려요.${suffix}`, keywords: ['감성 카페', '공원', '분위기 좋은 레스토랑'] },
      기쁘:      { summary: `😄 기쁜 날엔 특별한 장소에서 더 빛나요!${suffix}`, keywords: ['분위기 좋은 레스토랑', '루프탑 카페', '감성 카페'] },
      평온:      { summary: `😌 평온한 마음엔 조용한 공간이 딱이에요.${suffix}`, keywords: ['북카페', '공원', '조용한 카페'] },
      신남:      { summary: `🥳 신나는 날엔 신나게 즐길 수 있는 곳이 좋죠!${suffix}`, keywords: ['노래방', '볼링장', '보드게임카페'] },
      신나:      { summary: `🥳 에너지가 넘치는 날이네요!${suffix}`, keywords: ['노래방', '볼링장', '보드게임카페'] },
      우울:      { summary: `😔 우울할 땐 따뜻하게 몸을 녹이면 기분이 나아져요.${suffix}`, keywords: ['찜질방', '조용한 카페', '힐링 카페'] },
      슬프:      { summary: `😢 슬플 땐 나를 위한 시간이 필요해요.${suffix}`, keywords: ['힐링 카페', '북카페', '조용한 카페'] },
      그리워:    { summary: `🥹 그리운 감정은 감성적인 공간에서 달래봐요.${suffix}`, keywords: ['감성 카페', '북카페', '힐링 카페'] },
      허전:      { summary: `🌧️ 허전한 마음엔 포근한 공간이 위로가 돼요.${suffix}`, keywords: ['북카페', '힐링 카페', '조용한 카페'] },
      두근:      { summary: `💓 두근두근 설레는 날이군요! 분위기 있는 곳이 딱이에요.${suffix}`, keywords: ['분위기 좋은 레스토랑', '루프탑 카페', '감성 카페'] },
      긴장:      { summary: `😬 긴장을 풀어줄 조용하고 편안한 공간을 찾아봤어요.${suffix}`, keywords: ['조용한 카페', '북카페', '공원'] },
      고민:      { summary: `🤔 고민이 있을 땐 조용히 생각 정리할 수 있는 공간이 좋아요.${suffix}`, keywords: ['북카페', '조용한 카페', '공원'] },
      지루:      { summary: `😑 지루할 땐 색다른 경험이 필요해요!${suffix}`, keywords: ['방탈출', '오락실', '보드게임카페'] },
      열정:      { summary: `🔥 열정이 넘칠 땐 활기 있는 공간이 제격이에요!${suffix}`, keywords: ['클라이밍', '볼링장', '스포츠 바'] },
      생각:      { summary: `💭 생각 정리가 필요할 땐 조용한 공간이 좋아요.${suffix}`, keywords: ['북카페', '공원', '조용한 카페'] },
      지침:      { summary: `😪 지치셨군요. 푹 쉬어갈 수 있는 곳이 필요할 것 같아요.${suffix}`, keywords: ['찜질방', '스파', '조용한 카페'] },
      지쳐:      { summary: `😪 많이 지치셨군요. 따뜻하게 쉬어가세요.${suffix}`, keywords: ['찜질방', '스파', '조용한 카페'] },
      힘들:      { summary: `🥺 많이 힘드시겠어요. 잠깐 쉬어갈 수 있는 곳을 찾아봤어요.${suffix}`, keywords: ['찜질방', '힐링 카페', '북카페'] },
      외로:      { summary: `🫂 외로울 땐 따뜻한 사람들이 있는 공간이 위로가 돼요.${suffix}`, keywords: ['보드게임카페', '북카페', '힐링 카페'] },
      설레:      { summary: `💓 설레는 날엔 분위기 있는 특별한 곳이 어울려요!${suffix}`, keywords: ['분위기 좋은 레스토랑', '루프탑 카페', '야경 카페'] },
      스트레스:  { summary: `😤 스트레스받는 날이군요! 확 풀 수 있는 곳이 필요해요.${suffix}`, keywords: ['노래방', '볼링장', 'PC방'] },
      화나:      { summary: `😤 화날 땐 소리 질러 풀어버려요!${suffix}`, keywords: ['노래방', '볼링장', '방탈출'] },
      심심:      { summary: `🎮 심심할 때 신나게 즐길 수 있는 곳으로 가봐요!${suffix}`, keywords: ['오락실', '방탈출', '보드게임카페'] },
      무기력:    { summary: `😶 무기력할 땐 기분 전환이 필요해요.${suffix}`, keywords: ['힐링 카페', '공원', '북카페'] },
      불안:      { summary: `😰 불안한 마음을 달랠 수 있는 편안한 공간을 찾아봤어요.${suffix}`, keywords: ['조용한 카페', '북카페', '힐링 카페'] },
      뿌듯:      { summary: `🌟 뿌듯한 날엔 특별한 보상이 필요하죠!${suffix}`, keywords: ['파인다이닝', '분위기 좋은 레스토랑', '루프탑 카페'] },
      피곤:      { summary: `😮‍💨 피곤한 몸을 충전할 수 있는 곳을 찾아봤어요.${suffix}`, keywords: ['찜질방', '스파', '마사지'] },

      // ── 데이트/연인/썸 ──────────────────────────────────────────────────────
      데이트:    { summary: `💕 설레는 데이트를 위한 특별한 장소를 찾아봤어요!${suffix}`, keywords: ['분위기 좋은 레스토랑', '루프탑 카페', '데이트 카페'] },
      썸:        { summary: `💘 설레는 썸 타는 중이군요! 분위기 있는 곳이 딱이에요.${suffix}`, keywords: ['분위기 좋은 카페', '데이트 레스토랑', '루프탑 바'] },
      썸녀:      { summary: `💘 썸녀와의 특별한 만남! 분위기 있는 곳을 골라봤어요.${suffix}`, keywords: ['분위기 좋은 레스토랑', '루프탑 카페', '감성 카페'] },
      썸남:      { summary: `💘 썸남과의 설레는 만남을 위해 딱 맞는 곳을 찾았어요!${suffix}`, keywords: ['분위기 좋은 레스토랑', '루프탑 카페', '감성 카페'] },
      연인:      { summary: `💑 연인과 함께하는 특별한 시간을 위해 찾아봤어요!${suffix}`, keywords: ['데이트 레스토랑', '분위기 좋은 카페', '루프탑 레스토랑'] },
      남친:      { summary: `💑 남자친구와의 데이트 장소를 찾고 계시군요!${suffix}`, keywords: ['분위기 좋은 레스토랑', '루프탑 카페', '데이트 카페'] },
      여친:      { summary: `💑 여자친구와의 특별한 데이트를 위해 찾아봤어요!${suffix}`, keywords: ['분위기 좋은 레스토랑', '루프탑 카페', '데이트 카페'] },
      기념일:    { summary: `🎉 소중한 기념일을 위한 특별한 장소가 필요하죠!${suffix}`, keywords: ['파인다이닝', '루프탑 레스토랑', '분위기 좋은 레스토랑'] },
      프로포즈:  { summary: `💍 특별한 순간을 위한 최고의 장소를 찾아봤어요!${suffix}`, keywords: ['루프탑 레스토랑', '파인다이닝', '야경 레스토랑'] },
      결혼기념일: { summary: `💍 소중한 결혼기념일을 위한 특별한 곳을 찾아봤어요!${suffix}`, keywords: ['파인다이닝', '루프탑 레스토랑', '호텔 레스토랑'] },

      // ── 친구/모임/회식 ──────────────────────────────────────────────────────
      친구:      { summary: `🥳 친구들과 즐거운 시간을 보낼 수 있는 곳을 찾아봤어요!${suffix}`, keywords: ['포차', '이자카야', '보드게임카페'] },
      모임:      { summary: `👥 즐거운 모임을 위한 완벽한 장소를 찾아봤어요!${suffix}`, keywords: ['이자카야', '포차', '분위기 좋은 레스토랑'] },
      회식:      { summary: `🍻 즐거운 회식 자리를 위한 곳을 찾아봤어요!${suffix}`, keywords: ['이자카야', '한식 레스토랑', '포차'] },
      동료:      { summary: `👔 동료들과 즐거운 시간을 보낼 수 있는 곳을 찾아봤어요!${suffix}`, keywords: ['이자카야', '분위기 좋은 레스토랑', '포차'] },
      소개팅:    { summary: `😊 두근두근 소개팅을 위한 분위기 좋은 곳을 찾아봤어요!${suffix}`, keywords: ['분위기 좋은 카페', '데이트 레스토랑', '브런치 카페'] },
      가족:      { summary: `👨‍👩‍👧‍👦 가족과 함께 즐길 수 있는 곳을 찾아봤어요!${suffix}`, keywords: ['가족 레스토랑', '키즈카페', '뷔페'] },
      부모님:    { summary: `👪 부모님과 함께하는 소중한 시간을 위해 찾아봤어요!${suffix}`, keywords: ['한정식 레스토랑', '가족 레스토랑', '한식 레스토랑'] },
      아이:      { summary: `👶 아이와 함께 즐길 수 있는 곳을 찾아봤어요!${suffix}`, keywords: ['키즈카페', '가족 레스토랑', '어린이 체험관'] },
      어린이:    { summary: `🧒 어린이와 함께하는 특별한 나들이 장소예요!${suffix}`, keywords: ['키즈카페', '어린이 체험관', '놀이터'] },

      // ── 특별한 날 ──────────────────────────────────────────────────────────
      생일:      { summary: `🎂 특별한 생일을 더 빛내줄 완벽한 장소를 찾아봤어요!${suffix}`, keywords: ['파인다이닝', '분위기 좋은 레스토랑', '루프탑 카페'] },
      졸업:      { summary: `🎓 졸업을 축하해요! 특별한 날을 위한 멋진 장소를 찾아봤어요!${suffix}`, keywords: ['파인다이닝', '분위기 좋은 레스토랑', '루프탑 레스토랑'] },
      취업:      { summary: `🎉 취업을 축하해요! 자신에게 선물하는 특별한 곳을 찾아봤어요!${suffix}`, keywords: ['파인다이닝', '분위기 좋은 레스토랑', '루프탑 카페'] },
      합격:      { summary: `🏆 합격을 축하해요! 자축할 수 있는 특별한 장소를 찾아봤어요!${suffix}`, keywords: ['파인다이닝', '루프탑 레스토랑', '분위기 좋은 레스토랑'] },
      이별:      { summary: `💔 이별 후엔 나를 위한 시간이 필요해요. 좋은 곳을 찾아봤어요.${suffix}`, keywords: ['힐링 카페', '북카페', '조용한 카페'] },
      위로:      { summary: `🫂 힘든 마음을 달래줄 따뜻한 공간을 찾아봤어요.${suffix}`, keywords: ['힐링 카페', '북카페', '조용한 카페'] },

      // ── 혼자/1인 ────────────────────────────────────────────────────────────
      혼밥:      { summary: `🍽️ 혼자만의 여유로운 식사 시간이 필요한군요!${suffix}`, keywords: ['1인 식당', '혼밥 맛집', '카운터 레스토랑'] },
      혼카:      { summary: `☕ 혼자만의 카페 시간을 보내고 싶군요!${suffix}`, keywords: ['1인 카페', '조용한 카페', '북카페'] },
      혼자:      { summary: `🧘 혼자만의 조용한 시간이 필요하군요.${suffix}`, keywords: ['북카페', '조용한 카페', '1인 카페'] },
      나홀로:    { summary: `🚶 나홀로 힐링 시간을 위한 곳을 찾아봤어요.${suffix}`, keywords: ['북카페', '공원', '1인 카페'] },

      // ── 공부/작업 ────────────────────────────────────────────────────────────
      공부:      { summary: `📚 집중해서 공부할 수 있는 조용한 공간을 찾아봤어요!${suffix}`, keywords: ['스터디카페', '북카페', '조용한 카페'] },
      스터디:    { summary: `📖 함께 공부할 수 있는 스터디 공간이 필요군요!${suffix}`, keywords: ['스터디카페', '스터디 룸', '북카페'] },
      작업:      { summary: `💻 집중해서 작업할 수 있는 공간을 찾아봤어요!${suffix}`, keywords: ['작업하기 좋은 카페', '스터디카페', '조용한 카페'] },
      독서:      { summary: `📗 책 읽기 좋은 조용한 공간이 필요한군요!${suffix}`, keywords: ['북카페', '독립서점', '조용한 카페'] },

      // ── 야외/자연 ────────────────────────────────────────────────────────────
      피크닉:    { summary: `🧺 따사로운 햇살 아래 피크닉이 생각나는 날이네요!${suffix}`, keywords: ['공원', '한강 피크닉', '피크닉 장소'] },
      공원:      { summary: `🌳 자연 속에서 여유를 즐기고 싶군요!${suffix}`, keywords: ['공원', '산책로', '자연 공원'] },
      산책:      { summary: `🚶 산책하며 여유를 즐기고 싶군요!${suffix}`, keywords: ['산책로', '공원', '강변 산책'] },
      한강:      { summary: `🌊 한강에서 시원하게 즐기고 싶군요!${suffix}`, keywords: ['한강 공원', '한강뷰 카페', '한강 치킨'] },
      등산:      { summary: `🏔️ 등산으로 에너지를 충전하고 싶군요!${suffix}`, keywords: ['등산 코스', '등산로 입구', '산 카페'] },
      캠핑:      { summary: `⛺ 자연에서 캠핑을 즐기고 싶군요!${suffix}`, keywords: ['캠핑장', '글램핑', '카라반'] },

      // ── 반려동물 ────────────────────────────────────────────────────────────
      강아지:    { summary: `🐶 강아지와 함께 즐길 수 있는 곳을 찾아봤어요!${suffix}`, keywords: ['애견 카페', '반려견 동반 카페', '강아지 카페'] },
      고양이:    { summary: `🐱 고양이와 함께하는 특별한 시간이군요!${suffix}`, keywords: ['고양이 카페', '캣카페', '애묘 카페'] },
      반려동물:  { summary: `🐾 반려동물과 함께 방문할 수 있는 곳을 찾아봤어요!${suffix}`, keywords: ['반려동물 동반 카페', '애견 카페', '펫 프렌들리'] },
      펫카페:    { summary: `🐾 귀여운 동물 친구들과 힐링할 수 있는 곳이에요!${suffix}`, keywords: ['애견 카페', '고양이 카페', '토끼 카페'] },

      // ── 음식/맛집 (한식 세부) ────────────────────────────────────────────────
      배고파:    { summary: `🍽️ 배가 고프군요! 맛있는 걸 먹으면 기분도 좋아지죠.${suffix}`, keywords: ['맛집', '레스토랑', '이자카야'] },
      배고픔:    { summary: `🍽️ 배고플 땐 맛있는 걸 먹어야죠!${suffix}`, keywords: ['맛집', '레스토랑', '이자카야'] },
      밥:        { summary: `🍜 맛있는 걸 먹고 싶은 날이네요!${suffix}`, keywords: ['맛집', '한식 레스토랑', '분위기 좋은 레스토랑'] },
      맛집:      { summary: `🍽️ 맛있는 맛집을 찾고 계시군요!${suffix}`, keywords: ['맛집', '유명 레스토랑', '인기 맛집'] },
      국밥:      { summary: `🍲 든든한 국밥 한 그릇이 필요한 날이군요!${suffix}`, keywords: ['국밥집', '순대국밥', '돼지국밥'] },
      냉면:      { summary: `🍜 시원한 냉면이 생각나는 날이군요!${suffix}`, keywords: ['냉면 맛집', '평양냉면', '물냉면'] },
      떡볶이:    { summary: `🌶️ 매콤달콤한 떡볶이가 땡기는 날이네요!${suffix}`, keywords: ['떡볶이 맛집', '분식집', '로제 떡볶이'] },
      분식:      { summary: `🍢 푸짐한 분식으로 배를 채우고 싶군요!${suffix}`, keywords: ['분식집', '떡볶이 맛집', '순대 맛집'] },
      삼계탕:    { summary: `🍗 건강한 삼계탕으로 보양하고 싶군요!${suffix}`, keywords: ['삼계탕 맛집', '한방 삼계탕', '닭곰탕'] },
      해장:      { summary: `🍜 속을 달래줄 해장 음식이 필요한 날이군요!${suffix}`, keywords: ['해장국 맛집', '순대국', '콩나물국밥'] },
      보쌈:      { summary: `🥬 보쌈 한 상이 생각나는 날이군요!${suffix}`, keywords: ['보쌈 맛집', '족발 보쌈', '보쌈 레스토랑'] },
      족발:      { summary: `🍖 쫄깃한 족발이 땡기는 날이네요!${suffix}`, keywords: ['족발 맛집', '보쌈 족발', '족발집'] },
      한식:      { summary: `🍚 정갈한 한식이 먹고 싶은 날이네요!${suffix}`, keywords: ['한식 레스토랑', '한정식', '정식 맛집'] },
      고기:      { summary: `🥩 고기가 먹고 싶은 날이군요! 맛있는 고기집을 찾아봤어요.${suffix}`, keywords: ['고기집', '삼겹살 맛집', '한우 레스토랑'] },
      삼겹살:    { summary: `🥓 삼겹살이 당기는 날이군요!${suffix}`, keywords: ['삼겹살 맛집', '고기구이', '한우 삼겹살'] },
      갈비:      { summary: `🍖 갈비가 먹고 싶은 날이군요!${suffix}`, keywords: ['갈비집', '갈비 맛집', '한우 갈비'] },
      비빔밥:    { summary: `🍚 알록달록 비빔밥이 먹고 싶은 날이군요!${suffix}`, keywords: ['비빔밥 맛집', '한식 레스토랑', '돌솥비빔밥'] },
      쌈밥:      { summary: `🥬 신선한 쌈밥 한 상이 생각나는 날이군요!${suffix}`, keywords: ['쌈밥 맛집', '한식 레스토랑', '쌈채소 정식'] },
      제육볶음:  { summary: `🌶️ 매콤한 제육볶음이 당기는 날이군요!${suffix}`, keywords: ['제육볶음 맛집', '한식 레스토랑', '돼지고기 맛집'] },
      된장찌개:  { summary: `🍲 구수한 된장찌개가 생각나는 날이에요!${suffix}`, keywords: ['된장찌개 맛집', '한식 레스토랑', '청국장'] },
      순대:      { summary: `🌭 따뜻한 순대가 땡기는 날이군요!${suffix}`, keywords: ['순대 맛집', '분식집', '순대국밥'] },
      곰탕:      { summary: `🍲 진하고 구수한 곰탕이 생각나는 날이에요!${suffix}`, keywords: ['곰탕 맛집', '설렁탕', '한식 레스토랑'] },
      닭볶음탕:  { summary: `🍗 얼큰한 닭볶음탕이 땡기는 날이군요!${suffix}`, keywords: ['닭볶음탕 맛집', '닭한마리', '한식 레스토랑'] },
      닭한마리:  { summary: `🍗 든든한 닭한마리가 생각나는 날이에요!${suffix}`, keywords: ['닭한마리 맛집', '동대문 닭한마리', '닭볶음탕'] },
      수육:      { summary: `🥩 부드러운 수육이 먹고 싶은 날이군요!${suffix}`, keywords: ['수육 맛집', '보쌈 수육', '한식 레스토랑'] },
      흑돼지:    { summary: `🥩 제주 흑돼지가 생각나는 날이군요!${suffix}`, keywords: ['흑돼지 맛집', '제주 흑돼지', '고기구이'] },
      장어:      { summary: `🐍 힘 나는 장어가 생각나는 날이군요!${suffix}`, keywords: ['장어구이 맛집', '민물장어', '장어덮밥'] },
      조개구이:  { summary: `🦪 신선한 조개구이가 땡기는 날이군요!${suffix}`, keywords: ['조개구이 맛집', '해산물 레스토랑', '해물찜'] },
      대게:      { summary: `🦀 특별한 대게를 즐기고 싶은 날이군요!${suffix}`, keywords: ['대게 맛집', '킹크랩', '해산물 레스토랑'] },
      랍스터:    { summary: `🦞 럭셔리한 랍스터를 즐기고 싶군요!${suffix}`, keywords: ['랍스터 레스토랑', '해산물 레스토랑', '파인다이닝'] },
      막국수:    { summary: `🍜 시원하고 담백한 막국수가 생각나는 날이에요!${suffix}`, keywords: ['막국수 맛집', '메밀 막국수', '냉면 막국수'] },
      가정식:    { summary: `🍱 따뜻한 가정식이 생각나는 날이군요!${suffix}`, keywords: ['가정식 레스토랑', '집밥 맛집', '한식 정식'] },
      집밥:      { summary: `🍚 포근한 집밥 같은 음식이 먹고 싶군요!${suffix}`, keywords: ['가정식 레스토랑', '집밥 맛집', '한식 레스토랑'] },
      정식:      { summary: `🍱 정갈한 정식 한 상이 생각나는 날이군요!${suffix}`, keywords: ['정식 맛집', '한정식 레스토랑', '가정식 레스토랑'] },
      덮밥:      { summary: `🍛 간편하고 맛있는 덮밥이 당기는 날이군요!${suffix}`, keywords: ['덮밥 맛집', '규동', '돼지덮밥'] },
      샐러드:    { summary: `🥗 신선하고 건강한 샐러드가 먹고 싶은 날이군요!${suffix}`, keywords: ['샐러드 맛집', '샐러드 카페', '브런치 카페'] },

      // ── 음식/맛집 (일식/양식/기타) ───────────────────────────────────────────
      일식:      { summary: `🍣 일식이 먹고 싶군요!${suffix}`, keywords: ['스시 레스토랑', '오마카세', '이자카야'] },
      초밥:      { summary: `🍣 초밥 먹으러 가볼까요?${suffix}`, keywords: ['스시 레스토랑', '초밥 맛집', '오마카세'] },
      오마카세:  { summary: `🍱 특별한 오마카세 경험을 찾으시는군요!${suffix}`, keywords: ['오마카세', '스시 오마카세', '파인다이닝'] },
      양식:      { summary: `🍝 양식이 먹고 싶은 날이네요!${suffix}`, keywords: ['이탈리안 레스토랑', '파스타 레스토랑', '스테이크 레스토랑'] },
      파스타:    { summary: `🍝 파스타가 땡기는 날이군요!${suffix}`, keywords: ['이탈리안 레스토랑', '파스타 맛집', '파스타 레스토랑'] },
      스파게티:  { summary: `🍝 스파게티가 먹고 싶은 날이군요!${suffix}`, keywords: ['스파게티 맛집', '이탈리안 레스토랑', '파스타 레스토랑'] },
      리조또:    { summary: `🍚 크리미한 리조또가 생각나는 날이에요!${suffix}`, keywords: ['이탈리안 레스토랑', '리조또 맛집', '파스타 레스토랑'] },
      스테이크:  { summary: `🥩 근사한 스테이크 한 판이 필요한 날이네요!${suffix}`, keywords: ['스테이크 레스토랑', '파인다이닝', '양식 레스토랑'] },
      버거:      { summary: `🍔 두툼한 버거가 당기는 날이군요!${suffix}`, keywords: ['수제 버거', '버거 맛집', '스매시 버거'] },
      햄버거:    { summary: `🍔 햄버거 한 입이 생각나는 날이에요!${suffix}`, keywords: ['수제 버거', '햄버거 맛집', '버거집'] },
      샌드위치:  { summary: `🥪 가볍고 맛있는 샌드위치가 땡기는 날이군요!${suffix}`, keywords: ['샌드위치 카페', '브런치 카페', '베이글'] },
      중식:      { summary: `🥟 중국 요리가 먹고 싶군요!${suffix}`, keywords: ['중식당', '차이니즈 레스토랑', '딤섬'] },
      짜장면:    { summary: `🍜 짜장면이 당기는 날이군요!${suffix}`, keywords: ['중식당', '짜장면 맛집', '차이니즈 레스토랑'] },
      짬뽕:      { summary: `🌶️ 얼큰한 짬뽕이 생각나는 날이에요!${suffix}`, keywords: ['중식당', '짬뽕 맛집', '해물 짬뽕'] },
      탕수육:    { summary: `🍖 바삭한 탕수육이 땡기는 날이군요!${suffix}`, keywords: ['중식당', '탕수육 맛집', '차이니즈 레스토랑'] },
      해산물:    { summary: `🦞 신선한 해산물이 먹고 싶군요!${suffix}`, keywords: ['해산물 레스토랑', '횟집', '조개구이'] },
      횟집:      { summary: `🐟 신선한 회가 먹고 싶군요!${suffix}`, keywords: ['횟집', '스시 레스토랑', '해산물 레스토랑'] },
      낙지:      { summary: `🐙 낙지 요리가 먹고 싶은 날이군요!${suffix}`, keywords: ['낙지 맛집', '낙지볶음', '해산물 레스토랑'] },
      쭈꾸미:    { summary: `🦑 매콤한 쭈꾸미가 땡기는 날이군요!${suffix}`, keywords: ['쭈꾸미 맛집', '낙지볶음', '해산물 레스토랑'] },
      피자:      { summary: `🍕 피자가 먹고 싶은 날이네요!${suffix}`, keywords: ['피자 레스토랑', '이탈리안 레스토랑', '화덕 피자'] },
      치킨:      { summary: `🍗 치킨이 당기는 날이군요!${suffix}`, keywords: ['치킨집', '치킨 맛집', '치킨 바'] },
      닭갈비:    { summary: `🍗 매콤달콤한 닭갈비가 생각나는 날이에요!${suffix}`, keywords: ['닭갈비 맛집', '춘천 닭갈비', '치즈 닭갈비'] },
      곱창:      { summary: `🔥 곱창 구이가 먹고 싶은 날이군요!${suffix}`, keywords: ['곱창 맛집', '곱창구이', '막창'] },
      라멘:      { summary: `🍜 따뜻한 라멘 한 그릇이 필요한 날이군요!${suffix}`, keywords: ['라멘 맛집', '라멘집', '일본라멘'] },
      우동:      { summary: `🍜 따뜻한 우동 한 그릇이 생각나는 날이에요!${suffix}`, keywords: ['우동 맛집', '일식당', '가케우동'] },
      소바:      { summary: `🍜 담백한 소바가 먹고 싶군요!${suffix}`, keywords: ['소바 맛집', '메밀 소바', '일식당'] },
      칼국수:    { summary: `🍜 따뜻한 칼국수 한 그릇이 생각나는 날이에요!${suffix}`, keywords: ['칼국수 맛집', '바지락 칼국수', '들깨 칼국수'] },
      수제비:    { summary: `🍲 구수한 수제비가 생각나는 날이군요!${suffix}`, keywords: ['수제비 맛집', '감자 수제비', '칼국수 수제비'] },
      돈까스:    { summary: `🥩 바삭한 돈까스가 당기는 날이군요!${suffix}`, keywords: ['돈까스 맛집', '경양식 돈까스', '일식 돈카츠'] },
      돈카츠:    { summary: `🥩 바삭바삭한 돈카츠가 생각나는 날이군요!${suffix}`, keywords: ['돈카츠 맛집', '일식 돈카츠', '가츠동'] },
      김밥:      { summary: `🍱 든든한 김밥이 생각나는 날이에요!${suffix}`, keywords: ['김밥 맛집', '분식집', '충무김밥'] },
      불고기:    { summary: `🥩 달콤한 불고기가 먹고 싶은 날이군요!${suffix}`, keywords: ['불고기 맛집', '한식 레스토랑', '불고기 정식'] },
      샤브샤브:  { summary: `🍲 따뜻한 샤브샤브 한 냄비가 생각나는 날이에요!${suffix}`, keywords: ['샤브샤브 맛집', '무한리필 샤브샤브', '야채 샤브샤브'] },
      라볶이:    { summary: `🌶️ 매콤한 라볶이가 땡기는 날이군요!${suffix}`, keywords: ['분식집', '떡볶이 라면', '라볶이 맛집'] },
      카레:      { summary: `🍛 따뜻한 카레가 생각나는 날이군요!${suffix}`, keywords: ['카레 맛집', '인도 카레', '카레 전문점'] },
      찌개:      { summary: `🍲 얼큰한 찌개 한 뚝배기가 생각나는 날이군요!${suffix}`, keywords: ['찌개 맛집', '김치찌개', '부대찌개'] },
      김치찌개:  { summary: `🍲 구수한 김치찌개가 먹고 싶은 날이군요!${suffix}`, keywords: ['김치찌개 맛집', '한식 레스토랑', '된장찌개'] },
      부대찌개:  { summary: `🍲 푸짐한 부대찌개 한 냄비가 생각나는 날이에요!${suffix}`, keywords: ['부대찌개 맛집', '의정부 부대찌개', '부대볶음'] },
      순두부:    { summary: `🥚 따뜻한 순두부찌개가 생각나는 날이군요!${suffix}`, keywords: ['순두부찌개 맛집', '한식 레스토랑', '뚝배기 순두부'] },
      감자탕:    { summary: `🍖 든든한 감자탕이 생각나는 날이군요!${suffix}`, keywords: ['감자탕 맛집', '뼈해장국', '한식 레스토랑'] },
      설렁탕:    { summary: `🍲 따뜻한 설렁탕 한 그릇이 생각나는 날이에요!${suffix}`, keywords: ['설렁탕 맛집', '곰탕 맛집', '한식 레스토랑'] },
      쌀국수:    { summary: `🍜 시원한 쌀국수가 생각나는 날이네요!${suffix}`, keywords: ['쌀국수 맛집', '베트남 음식', '포'] },
      베트남:    { summary: `🌿 상큼한 베트남 요리가 먹고 싶군요!${suffix}`, keywords: ['베트남 음식', '쌀국수', '반미 맛집'] },
      태국:      { summary: `🌶️ 이국적인 태국 요리가 생각나는 날이에요!${suffix}`, keywords: ['태국 음식', '팟타이', '태국 레스토랑'] },
      인도:      { summary: `🍛 풍미 가득한 인도 요리가 먹고 싶군요!${suffix}`, keywords: ['인도 음식', '커리 레스토랑', '인도 레스토랑'] },
      멕시코:    { summary: `🌮 신나는 멕시칸 요리가 생각나는 날이군요!${suffix}`, keywords: ['멕시칸 레스토랑', '타코 맛집', '부리토'] },
      뷔페:      { summary: `🍽️ 다양한 음식을 실컷 즐기고 싶군요!${suffix}`, keywords: ['뷔페 레스토랑', '무한리필', '호텔 뷔페'] },
      무한리필:  { summary: `♾️ 실컷 먹을 수 있는 무한리필 맛집을 찾아봤어요!${suffix}`, keywords: ['무한리필 레스토랑', '뷔페', '무한 삼겹살'] },

      // ── 술/바 ────────────────────────────────────────────────────────────────
      술:        { summary: `🍺 가볍게 한잔하고 싶은 밤이네요.${suffix}`, keywords: ['이자카야', '포차', '루프탑 바'] },
      술집:      { summary: `🍻 분위기 좋은 술집에서 즐거운 시간을 보내고 싶군요!${suffix}`, keywords: ['이자카야', '포차', '한식 주점'] },
      이자카야:  { summary: `🍶 이자카야에서 분위기 있게 한잔하고 싶군요!${suffix}`, keywords: ['이자카야', '일본식 주점', '야키토리 바'] },
      포차:      { summary: `🏮 포장마차에서 편하게 한잔하고 싶은 날이네요!${suffix}`, keywords: ['포차', '포장마차', '한식 주점'] },
      맥주:      { summary: `🍺 시원한 맥주 한 잔이 필요한 날이군요!${suffix}`, keywords: ['수제맥주 바', '이자카야', '펍'] },
      수제맥주:  { summary: `🍺 다양한 수제맥주를 즐기고 싶군요!${suffix}`, keywords: ['수제맥주 바', '크래프트 비어', '펍'] },
      하이볼:    { summary: `🥃 청량한 하이볼 한 잔이 필요한 밤이네요!${suffix}`, keywords: ['하이볼 바', '이자카야', '칵테일 바'] },
      와인:      { summary: `🍷 와인 한 잔으로 분위기를 내고 싶군요!${suffix}`, keywords: ['와인 바', '와인 레스토랑', '비스트로'] },
      칵테일:    { summary: `🍹 분위기 있는 칵테일 한 잔이 필요한 밤이네요!${suffix}`, keywords: ['칵테일 바', '루프탑 바', '이자카야'] },
      막걸리:    { summary: `🍶 시원한 막걸리 한 잔이 생각나는 날이군요!${suffix}`, keywords: ['막걸리 바', '전통 술집', '막걸리 맛집'] },
      소주:      { summary: `🍶 소주 한 잔이 필요한 밤이군요!${suffix}`, keywords: ['포차', '한식 주점', '이자카야'] },
      전통주:    { summary: `🍶 우리 전통주의 깊은 맛을 찾고 계시는군요!${suffix}`, keywords: ['전통주 바', '막걸리 바', '전통 술집'] },
      바:        { summary: `🍸 분위기 있는 바에서 한잔하고 싶군요!${suffix}`, keywords: ['루프탑 바', '칵테일 바', '와인 바'] },
      클럽:      { summary: `💃 신나는 클럽에서 에너지를 불태우고 싶군요!${suffix}`, keywords: ['클럽', '나이트클럽', '라이브 클럽'] },

      // ── 분위기/스타일 ───────────────────────────────────────────────────────
      분위기:    { summary: `✨ 분위기 있는 곳에서 특별한 시간을 보내고 싶군요!${suffix}`, keywords: ['분위기 좋은 레스토랑', '감성 카페', '루프탑 카페'] },
      야경:      { summary: `🌃 아름다운 야경과 함께하고 싶군요!${suffix}`, keywords: ['야경 레스토랑', '루프탑 카페', '야경 카페'] },
      루프탑:    { summary: `🌇 탁 트인 루프탑에서 즐기고 싶군요!${suffix}`, keywords: ['루프탑 카페', '루프탑 바', '루프탑 레스토랑'] },
      뷰:        { summary: `🌅 멋진 뷰를 즐기고 싶군요!${suffix}`, keywords: ['뷰 맛집', '루프탑 카페', '한강뷰 카페'] },
      힙:        { summary: `😎 힙하고 트렌디한 공간을 찾고 계시군요!${suffix}`, keywords: ['힙한 카페', '감성 레스토랑', '비스트로'] },
      감성:      { summary: `🎨 감성 넘치는 공간이 필요하군요!${suffix}`, keywords: ['감성 카페', '인테리어 카페', '독립서점 카페'] },
      조용:      { summary: `🤫 조용하고 프라이빗한 공간을 원하시는군요!${suffix}`, keywords: ['조용한 카페', '북카페', '프라이빗 레스토랑'] },
      힐링:      { summary: `🌿 힐링이 필요한 날이군요. 편안한 곳을 찾아봤어요.${suffix}`, keywords: ['힐링 카페', '공원', '찜질방'] },
      트렌디:    { summary: `✨ 트렌디하고 세련된 공간을 찾고 계시군요!${suffix}`, keywords: ['트렌디 카페', '감성 레스토랑', '힙한 바'] },
      고급:      { summary: `💎 고급스러운 분위기를 즐기고 싶군요!${suffix}`, keywords: ['파인다이닝', '호텔 레스토랑', '루프탑 레스토랑'] },
      럭셔리:    { summary: `💎 럭셔리한 특별한 경험을 찾고 계시는군요!${suffix}`, keywords: ['파인다이닝', '호텔 레스토랑', '스파'] },
      인스타:    { summary: `📸 인스타 감성 가득한 핫플을 찾고 계시는군요!${suffix}`, keywords: ['인스타 맛집', '감성 카페', '포토존 카페'] },
      핫플:      { summary: `🔥 요즘 핫한 장소를 찾고 계시는군요!${suffix}`, keywords: ['핫플레이스', '인기 맛집', '트렌디 카페'] },

      // ── 뷰티/휴식 ────────────────────────────────────────────────────────────
      스파:      { summary: `💆 스파에서 몸과 마음을 충전하고 싶군요!${suffix}`, keywords: ['스파', '마사지', '힐링 스파'] },
      마사지:    { summary: `💆 피로를 풀어줄 마사지가 필요한 날이네요!${suffix}`, keywords: ['마사지 샵', '스파', '스웨디시'] },
      찜질:      { summary: `♨️ 찜질방에서 온몸을 풀고 싶군요!${suffix}`, keywords: ['찜질방', '스파', '사우나'] },

      // ── 사진/포토 ────────────────────────────────────────────────────────────
      사진:      { summary: `📸 멋진 사진을 찍을 수 있는 곳을 찾아봤어요!${suffix}`, keywords: ['포토존 카페', '인스타 맛집', '감성 카페'] },
      포토부스:  { summary: `🎞️ 추억을 남길 수 있는 포토부스를 찾아봤어요!${suffix}`, keywords: ['포토부스', '인생네컷', '셀프 스튜디오'] },
      셀프사진:  { summary: `📷 특별한 셀프 사진을 찍고 싶군요!${suffix}`, keywords: ['셀프 스튜디오', '포토부스', '인생네컷'] },

      // ── 쇼핑/문화 ────────────────────────────────────────────────────────────
      쇼핑:      { summary: `🛍️ 쇼핑하기 좋은 곳을 찾아봤어요!${suffix}`, keywords: ['쇼핑몰', '백화점', '플리마켓'] },
      플리마켓:  { summary: `🛒 개성 있는 플리마켓을 즐기고 싶군요!${suffix}`, keywords: ['플리마켓', '벼룩시장', '수공예 마켓'] },
      서점:      { summary: `📚 책 속에서 여유를 찾고 싶군요!${suffix}`, keywords: ['독립서점', '복합 문화 공간', '북카페'] },

      // ── 액티비티 ────────────────────────────────────────────────────────────
      노래:      { summary: `🎤 노래가 하고 싶은 날이군요!${suffix}`, keywords: ['노래방', '라이브 카페', '음악 카페'] },
      볼링:      { summary: `🎳 볼링으로 신나게 즐기고 싶군요!${suffix}`, keywords: ['볼링장', '오락실', '당구장'] },
      당구:      { summary: `🎱 당구 한 게임이 생각나는 날이군요!${suffix}`, keywords: ['당구장', '포켓볼', '스누커'] },
      다트:      { summary: `🎯 다트로 스트레스를 날려버려요!${suffix}`, keywords: ['다트 바', '다트 카페', '보드게임카페'] },
      방탈출:    { summary: `🔐 스릴 넘치는 방탈출 도전!${suffix}`, keywords: ['방탈출 카페', '미션 방탈출', '공포 방탈출'] },
      보드게임:  { summary: `🎲 보드게임으로 친구들과 즐거운 시간을 보내고 싶군요!${suffix}`, keywords: ['보드게임카페', '테이블게임', '방탈출 카페'] },
      운동:      { summary: `💪 에너지를 발산하고 싶은 날이군요!${suffix}`, keywords: ['클라이밍', '볼링장', '스쿼시'] },
      클라이밍:  { summary: `🧗 클라이밍으로 스릴을 즐기고 싶군요!${suffix}`, keywords: ['클라이밍 센터', '볼더링', '인공암벽'] },
      요가:      { summary: `🧘 요가로 몸과 마음을 정돈하고 싶군요!${suffix}`, keywords: ['요가 스튜디오', '필라테스', '명상 센터'] },
      필라테스:  { summary: `🤸 필라테스로 건강하게 운동하고 싶군요!${suffix}`, keywords: ['필라테스 스튜디오', '요가 스튜디오', '헬스장'] },
      테니스:    { summary: `🎾 테니스로 활기차게 운동하고 싶군요!${suffix}`, keywords: ['테니스장', '테니스 클럽', '스쿼시장'] },
      골프:      { summary: `⛳ 골프를 즐기고 싶은 날이군요!${suffix}`, keywords: ['스크린골프', '골프 연습장', '골프장'] },
      스크린골프: { summary: `⛳ 스크린골프로 가볍게 즐기고 싶군요!${suffix}`, keywords: ['스크린골프', '골프 연습장', '골프 카페'] },
      탁구:      { summary: `🏓 탁구로 신나게 즐기고 싶군요!${suffix}`, keywords: ['탁구장', '탁구 클럽', '스포츠 센터'] },
      풋살:      { summary: `⚽ 풋살로 에너지를 발산하고 싶군요!${suffix}`, keywords: ['풋살장', '실내 풋살', '풋살 클럽'] },
      축구:      { summary: `⚽ 축구로 신나게 뛰어보고 싶군요!${suffix}`, keywords: ['풋살장', '축구장', '실내 풋살'] },
      배드민턴:  { summary: `🏸 배드민턴으로 가볍게 운동하고 싶군요!${suffix}`, keywords: ['배드민턴장', '스포츠 센터', '탁구장'] },
      수영:      { summary: `🏊 수영으로 상쾌하게 운동하고 싶군요!${suffix}`, keywords: ['수영장', '실내 수영장', '스포츠 센터'] },
      자전거:    { summary: `🚴 자전거 타며 바람을 즐기고 싶군요!${suffix}`, keywords: ['자전거 대여', '자전거 코스', '한강 자전거'] },
      서핑:      { summary: `🏄 파도와 함께 서핑을 즐기고 싶군요!${suffix}`, keywords: ['서핑 스쿨', '서핑 강습', '웨이크보드'] },
      스케이트:  { summary: `⛸️ 스케이트를 타며 신나게 즐기고 싶군요!${suffix}`, keywords: ['아이스링크', '스케이트장', '롤러장'] },
      전시:      { summary: `🎨 문화생활로 감성을 충전하고 싶군요!${suffix}`, keywords: ['전시회', '갤러리', '미술관'] },
      영화:      { summary: `🎬 영화를 보고 싶은 날이군요!${suffix}`, keywords: ['영화관', '독립영화관', '멀티플렉스'] },
      공연:      { summary: `🎭 감동적인 공연을 보고 싶군요!${suffix}`, keywords: ['공연장', '뮤지컬', '연극'] },
      뮤지컬:    { summary: `🎭 뮤지컬 관람으로 감성을 충전하고 싶군요!${suffix}`, keywords: ['뮤지컬 공연', '뮤지컬 티켓', '공연장'] },
      게임:      { summary: `🎮 게임으로 스트레스를 풀고 싶군요!${suffix}`, keywords: ['PC방', '오락실', '보드게임카페'] },
      PC방:      { summary: `🖥️ PC방에서 신나게 게임을 즐기고 싶군요!${suffix}`, keywords: ['PC방', '게임 카페', '오락실'] },
      오락실:    { summary: `🕹️ 오락실에서 신나게 즐기고 싶군요!${suffix}`, keywords: ['오락실', '게임 센터', '아케이드'] },

      // ── 기타 ────────────────────────────────────────────────────────────────
      네일:      { summary: `💅 예쁜 네일로 기분 전환하고 싶군요!${suffix}`, keywords: ['네일샵', '젤 네일', '네일 아트'] },
      미용:      { summary: `✂️ 헤어샵에서 새 단장을 하고 싶군요!${suffix}`, keywords: ['헤어샵', '미용실', '헤어 살롱'] },
      피부:      { summary: `✨ 피부 케어를 받고 싶은 날이군요!${suffix}`, keywords: ['피부관리샵', '에스테틱', '피부 클리닉'] },
      목욕:      { summary: `♨️ 따뜻하게 목욕하며 피로를 풀고 싶군요!${suffix}`, keywords: ['찜질방', '사우나', '목욕탕'] },
      사우나:    { summary: `🧖 사우나에서 몸을 풀고 싶군요!${suffix}`, keywords: ['사우나', '찜질방', '스파'] },
    };

    for (const [key, val] of Object.entries(map)) {
      if (query.includes(key)) {
        // 위치 감지 시 키워드에 prefix 적용 (예: "노원구 감성 카페")
        const keywords = locPrefix
          ? val.keywords.map((kw) => kw.startsWith(locPrefix) ? kw : `${locPrefix}${kw}`)
          : val.keywords;
        this.logger.log(`QuickMatch: "${key}"${locPrefix ? ` (위치: ${detectedLocation})` : ''} → ${keywords.join(', ')}`);
        return { ...val, keywords, location: detectedLocation ?? undefined };
      }
    }

    // 위치명만 입력된 경우 (예: "노원구") → 위치 기반 기본 검색
    if (detectedLocation) {
      this.logger.log(`QuickMatch: 위치명만 감지 "${detectedLocation}" → 기본 탐색 키워드`);
      return {
        summary: `📍 ${detectedLocation} 주변에서 어울리는 곳을 찾아봤어요!`,
        keywords: [`${detectedLocation} 카페`, `${detectedLocation} 맛집`, `${detectedLocation} 분위기 좋은 곳`],
        location: detectedLocation,
      };
    }

    return null; // 매칭 실패 → Gemini 호출
  }

  // ── 폴백 분석 (Gemini 실패 시 사용) ─────────────────────────────────────────
  private buildFallbackAnalysis(query: string, regionLabel?: string): GeminiAnalysis {
    const quick = this.tryQuickMatch(query, regionLabel);
    if (quick) return quick;
    const region = regionLabel && regionLabel !== '내 위치' && regionLabel !== '전체' ? regionLabel : '근처';
    return {
      summary:  `오늘 기분에 딱 맞는 곳을 찾았어요! ${region}에서 어울리는 장소를 추천해드릴게요 🗺️`,
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
    // 월간 리포트는 프리미엄 전용
    if (period === 'monthly') {
      const subscribed = await this.creditService.isSubscribed(userId);
      if (!subscribed) {
        throw new ForbiddenException('월간 바이브 리포트는 프리미엄 기능이에요. 구독 후 이용해주세요!');
      }
    }

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
당신은 한국 장소 추천 전문가입니다.
사용자의 요청에서 ① 구체적인 동네/위치 ② 목적/상황 ③ 원하는 분위기를 정확히 파악하여 카카오맵에서 실제로 검색 가능한 키워드를 추출하세요.

사용자 입력: {query}
선택된 광역 지역: {region}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "summary": "2~3문장 공감 메시지 (총 100자 내외, 이모지 포함, 친근한 말투): ① 상황/목적에 공감 ② 추천 이유 ③ {region}에서 찾아봤다는 마무리",
  "location": "사용자 입력에서 감지된 읍/면/동 또는 동네명 (예: '합정', '이태원', '성수동'). 없으면 null",
  "keywords": ["카카오맵 검색 키워드1", "키워드2", "키워드3"]
}

location 감지 규칙:
- 서울 동네/상권: 합정, 홍대, 이태원, 강남, 신촌, 성수, 건대, 혜화, 명동, 잠실, 여의도, 압구정, 연남, 망원, 한남, 가로수길, 을지로, 익선동, 충무로 등
- 서울 구(區) 단위: 노원구, 마포구, 강남구, 서초구, 송파구, 강서구, 은평구, 도봉구, 강동구 등
- 전국 광역시·도: 부산, 대구, 인천, 광주, 대전, 울산, 세종, 제주, 강원, 충북, 충남, 전북, 전남, 경북, 경남
- 전국 주요 도시: 수원, 성남, 용인, 고양, 일산, 부천, 안양, 안산, 화성, 남양주, 춘천, 강릉, 속초, 청주, 천안, 아산, 전주, 군산, 창원, 포항, 경주, 김해, 제주시, 서귀포 등
- 읍/면/동 단위 (합정동, 성수동, 해운대동 등) 포함
- 을지로 감지 시 location을 "을지로3가"로 설정할 것 (을지로1가는 종각 인근이므로 힙한 상권인 3가 기준으로 검색)
- location 감지 시 반드시 keywords의 모든 항목 앞에 해당 위치명을 prefix로 붙일 것 (예: "속초 카페", "해운대 맛집", "전주 한옥마을")

keywords 작성 규칙 (반드시 3개, 한국어):
1. location이 감지된 경우 → 각 키워드마다 동네명을 앞에 붙임
   - "합정동에서 분위기 좋은 식당" → ["합정 레스토랑", "합정동 분위기 좋은 카페", "합정 양식 맛집"]
   - "홍대 근처 카페" → ["홍대 카페", "홍대 감성 카페", "홍대 브런치 카페"]
   - "이태원 바" → ["이태원 바", "이태원 루프탑 바", "이태원 칵테일 바"]
2. 목적/상황별 정확한 키워드:
   - 데이트/썸/연인 → "분위기 좋은 레스토랑", "데이트 카페", "루프탑 카페" (특정 동네 있으면 앞에 붙임)
   - 기념일/프로포즈 → "파인다이닝", "루프탑 레스토랑", "분위기 좋은 레스토랑"
   - 친구 모임/회식 → "이자카야", "포차", "보드게임카페"
   - 혼자/조용히 → "북카페", "조용한 카페", "1인 카페"
   - 가족/아이 → "가족 레스토랑", "키즈카페", "브런치 카페"
3. 분위기/스타일 키워드:
   - 트렌디/힙한 → "감성 카페", "힙한 레스토랑", "비스트로"
   - 럭셔리/고급 → "파인다이닝", "오마카세", "루프탑 레스토랑"
   - 아늑/편안 → "북카페", "브런치 카페", "조용한 카페"
   - 활기/신남 → "노래방", "볼링장", "보드게임카페"
4. 음식 종류가 구체적으로 언급된 경우:
   - 고기 → "삼겹살 맛집", "한우 레스토랑", "고기구이"
   - 일식 → "오마카세", "스시 레스토랑", "이자카야"
   - 양식 → "파스타 레스토랑", "스테이크 레스토랑", "비스트로"
   - 한식 → "한식 레스토랑", "한정식", "전통 음식점"
   - 중식 → "중식당", "차이니즈 레스토랑", "딤섬"
5. 절대 하지 말 것: 상황에 맞지 않는 장소 추천 (예: 데이트인데 국밥집, 럭셔리인데 분식집)
`.trim();


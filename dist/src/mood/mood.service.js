"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MoodService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoodService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const kakao_service_1 = require("../place/kakao.service");
const google_places_service_1 = require("../place/google-places.service");
const place_service_1 = require("../place/place.service");
let MoodService = MoodService_1 = class MoodService {
    prisma;
    config;
    kakao;
    googlePlaces;
    placeService;
    logger = new common_1.Logger(MoodService_1.name);
    constructor(prisma, config, kakao, googlePlaces, placeService) {
        this.prisma = prisma;
        this.config = config;
        this.kakao = kakao;
        this.googlePlaces = googlePlaces;
        this.placeService = placeService;
    }
    async search(query, userId, lat, lng) {
        const searchLat = lat ?? 37.5665;
        const searchLng = lng ?? 126.9780;
        const quickMatch = this.tryQuickMatch(query);
        const analysis = quickMatch ?? (await this.analyzeWithGemini(query));
        const kakaoResults = await this.searchKakaoPlaces(analysis.keywords, searchLat, searchLng);
        const enrichedResults = await this.googlePlaces.enrichPlaces(kakaoResults);
        await this.placeService.upsertKakaoPlaces(enrichedResults);
        const mergedResults = await this.placeService.mergeDbRatings(enrichedResults);
        this.saveMoodSearchLog(query, analysis.summary, userId, mergedResults).catch((err) => this.logger.error('검색 로그 저장 실패', err));
        return {
            summary: analysis.summary,
            places: mergedResults,
            keywords: analysis.keywords,
            query,
            fallback: false,
        };
    }
    async analyzeWithGemini(query) {
        const template = await this.prisma.promptTemplate.findUnique({
            where: { type: 'MOOD_ANALYSIS' },
        });
        const systemPrompt = template?.template ?? DEFAULT_PROMPT;
        const userPrompt = systemPrompt.replace('{query}', query);
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.config.get('GEMINI_API_KEY')}`, {
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
            });
            const data = await res.json();
            this.logger.debug(`Gemini raw: ${JSON.stringify(data).slice(0, 500)}`);
            if (data.error) {
                this.logger.error('Gemini API 오류', data.error);
                return this.buildFallbackAnalysis(query);
            }
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            this.logger.debug(`Gemini text: ${text.slice(0, 300)}`);
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.summary && Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
                    this.logger.log(`Gemini 키워드: ${parsed.keywords.join(', ')}`);
                    return {
                        summary: parsed.summary,
                        keywords: parsed.keywords.slice(0, 3),
                    };
                }
            }
            this.logger.warn(`Gemini JSON 파싱 실패. text="${text.slice(0, 100)}"`);
            return this.buildFallbackAnalysis(query);
        }
        catch (err) {
            this.logger.error('Gemini API 호출 실패 → 폴백', err);
            return this.buildFallbackAnalysis(query);
        }
    }
    async searchKakaoPlaces(keywords, lat, lng) {
        const resultSets = await Promise.all(keywords.map((kw) => this.kakao.searchByKeyword(kw, lat, lng)));
        const seen = new Set();
        const merged = [];
        const maxLen = Math.max(...resultSets.map((r) => r.length));
        for (let i = 0; i < maxLen && merged.length < 10; i++) {
            for (const set of resultSets) {
                if (merged.length >= 10)
                    break;
                const place = set[i];
                if (place && !seen.has(place.id)) {
                    seen.add(place.id);
                    merged.push(place);
                }
            }
        }
        return merged;
    }
    tryQuickMatch(query) {
        const map = {
            카페: { summary: '☕ 향긋한 커피와 함께 여유로운 시간을 보내봐요!', keywords: ['카페', '북카페', '루프탑 카페'] },
            커피: { summary: '☕ 커피 한 잔으로 여유를 즐겨봐요!', keywords: ['카페', '북카페', '루프탑 카페'] },
            행복: { summary: '😊 행복한 기분엔 활기찬 카페나 공원이 잘 어울려요!', keywords: ['카페', '공원', '맛집'] },
            평온: { summary: '😌 평온한 마음엔 조용한 북카페가 딱이에요.', keywords: ['북카페', '공원', '조용한 카페'] },
            신남: { summary: '🥳 신나는 날엔 노래방이나 볼링 어때요?', keywords: ['노래방', '볼링장', '보드게임카페'] },
            신나: { summary: '🥳 신나는 날엔 노래방이나 볼링 어때요?', keywords: ['노래방', '볼링장', '보드게임카페'] },
            우울: { summary: '😔 우울할 땐 찜질방에서 몸을 녹여봐요.', keywords: ['찜질방', '카페', '공원'] },
            열정: { summary: '🔥 열정이 넘칠 때는 활기찬 공간이 좋아요!', keywords: ['클라이밍', '볼링장', '레스토랑'] },
            생각: { summary: '💭 생각 정리엔 조용한 공간이 좋아요.', keywords: ['북카페', '공원', '독서실'] },
            지침: { summary: '😪 지쳤을 땐 조용히 쉴 수 있는 곳으로.', keywords: ['찜질방', '공원', '조용한 카페'] },
            지쳐: { summary: '😪 지쳐있을 때 따뜻하게 쉬어가요.', keywords: ['찜질방', '공원', '조용한 카페'] },
            배고파: { summary: '🍽️ 배고플 땐 맛집으로 고고!', keywords: ['맛집', '레스토랑', '이자카야'] },
            배고픔: { summary: '🍽️ 배고플 땐 맛집으로 고고!', keywords: ['맛집', '레스토랑', '이자카야'] },
            심심: { summary: '🎮 심심할 땐 오락실이나 방탈출 어때요?', keywords: ['오락실', '방탈출', '보드게임카페'] },
            스트레스: { summary: '😤 스트레스는 확 풀어버려요!', keywords: ['노래방', '볼링장', 'PC방'] },
            화나: { summary: '😤 화날 땐 소리 지르고 싶죠! 노래방 어때요?', keywords: ['노래방', '볼링장', '방탈출'] },
            외로: { summary: '🫂 외로울 땐 따뜻한 공간으로.', keywords: ['보드게임카페', '북카페', '공원'] },
            설레: { summary: '💓 설레는 날엔 분위기 있는 곳으로!', keywords: ['루프탑 카페', '레스토랑', '야경 명소'] },
            데이트: { summary: '💕 데이트엔 특별한 장소가 필요하죠!', keywords: ['루프탑 카페', '레스토랑', '야경 명소'] },
            노래: { summary: '🎤 노래하고 싶을 땐 노래방으로!', keywords: ['노래방', '라이브카페', '음악카페'] },
            볼링: { summary: '🎳 볼링장에서 신나게 놀아봐요!', keywords: ['볼링장', '오락실', '당구장'] },
            술: { summary: '🍺 가볍게 한잔하고 싶은 밤.', keywords: ['이자카야', '포차', '바'] },
            밥: { summary: '🍜 맛있는 거 먹으러 가봐요!', keywords: ['맛집', '레스토랑', '국밥'] },
            운동: { summary: '💪 운동으로 에너지를 발산해봐요!', keywords: ['클라이밍', '볼링장', '헬스장'] },
        };
        for (const [key, val] of Object.entries(map)) {
            if (query.includes(key)) {
                this.logger.log(`QuickMatch: "${key}" → ${val.keywords.join(', ')}`);
                return val;
            }
        }
        return null;
    }
    buildFallbackAnalysis(query) {
        const quick = this.tryQuickMatch(query);
        if (quick)
            return quick;
        return {
            summary: `오늘 기분에 어울리는 장소를 찾아봤어요! 🗺️`,
            keywords: ['카페', '공원', '맛집'],
        };
    }
    async saveMoodSearchLog(query, summary, userId, places) {
        await this.prisma.moodSearch.create({
            data: {
                userId: userId ?? null,
                query,
                mood: query,
                summary,
            },
        });
    }
    async getVibeReport(userId, period) {
        const existing = await this.prisma.vibeReport.findUnique({
            where: { userId_period: { userId, period } },
        });
        if (existing)
            return existing;
        const checkIns = await this.prisma.checkIn.findMany({
            where: { userId },
            include: { place: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        const moodCounts = {};
        checkIns.forEach((c) => {
            moodCounts[c.mood] = (moodCounts[c.mood] ?? 0) + 1;
        });
        const summary = {
            totalCheckins: checkIns.length,
            topMoods: Object.entries(moodCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3),
            topPlaces: checkIns.slice(0, 3).map((c) => ({
                id: c.placeId, name: c.place.name,
            })),
        };
        return this.prisma.vibeReport.create({ data: { userId, period, summary } });
    }
};
exports.MoodService = MoodService;
exports.MoodService = MoodService = MoodService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        kakao_service_1.KakaoService,
        google_places_service_1.GooglePlacesService,
        place_service_1.PlaceService])
], MoodService);
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
//# sourceMappingURL=mood.service.js.map
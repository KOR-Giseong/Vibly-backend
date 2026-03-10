# Vibly Backend — NestJS REST API 서버

Vibly 앱의 백엔드 서버입니다. NestJS + Prisma + PostgreSQL 기반으로 인증, 장소 검색, AI 추천, 커플 기능 등 전체 API를 제공합니다.

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | NestJS 11 |
| 언어 | TypeScript |
| ORM | Prisma 7 |
| 데이터베이스 | PostgreSQL |
| 캐시 / 큐 | Redis, Bull |
| 인증 | JWT (Access + Refresh Token), Passport |
| AI | Google Gemini 2.5 Flash |
| 장소 | 카카오 로컬 API, Google Places API |
| 파일 저장 | Cloudflare R2 (S3 호환) |
| 이메일 | Resend |
| 푸시 알림 | Expo Server SDK |
| 보안 | Helmet, Throttler (Rate Limiting) |
| API 문서 | Swagger |
| 배포 | Render |

---

## 주요 모듈

### 인증 (`auth`)
- 이메일/비밀번호 회원가입·로그인
- 카카오 소셜 로그인
- JWT Access / Refresh Token 발급 및 갱신
- 이메일 인증

### 장소 (`place`)
- 카카오 로컬 API 키워드 검색
- Google Places API 사진·평점 보완
- 북마크, 체크인, 리뷰

### AI 무드 검색 (`mood`)
- 자연어 쿼리 → Gemini 분석 → 카카오 장소 검색
- 빠른 키워드 매칭으로 Gemini 호출 최소화
- 취향 바이브 기반 결과 정렬

### 커플 (`couple`)
- 커플 초대·수락·해제
- 데이트 플랜 CRUD
- 추억 사진 업로드 (R2 저장)
- AI 데이트 코스 분석 (15크레딧): Gemini 2단계 호출 + 카카오 실장소 검색
- AI 대화형 데이트 비서 (프리미엄): 커플 컨텍스트 기반 대화
- AI 타임라인 수정 (2크레딧)

### 크레딧 (`credit`)
- 출석 체크 (연속 출석 보너스)
- 크레딧 차감·충전
- 구독 관리

### 알림 (`notification`)
- Expo Push Notification 발송
- 커플 초대, 출석, AI 분석 완료 알림

### 커뮤니티 (`community`)
- 게시글·댓글 CRUD
- 좋아요, 신고

### 관리자
- 유저·커플·커뮤니티·크레딧·구독 관리
- 신고 처리, 공지사항

---

## 프로젝트 구조

```
src/
├── auth/           # 인증 (JWT, 소셜 로그인)
├── couple/         # 커플 기능 + AI 데이트 분석
├── credit/         # 크레딧·구독
├── mood/           # AI 장소 추천
├── place/          # 장소 검색 (카카오, Google)
├── notification/   # 푸시 알림
├── community/      # 커뮤니티
├── storage/        # Cloudflare R2 파일 업로드
├── prisma/         # Prisma 서비스
└── main.ts
```

---

## 실행 방법

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env

# Prisma 마이그레이션
npx prisma migrate dev

# 개발 서버 실행
npm run start:dev
```

### 환경변수 주요 항목

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
GEMINI_API_KEY=...
KAKAO_REST_API_KEY=...
GOOGLE_PLACES_API_KEY=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
REDIS_URL=...
EXPO_ACCESS_TOKEN=...
```

---

## API 문서

서버 실행 후 `/api` 경로에서 Swagger UI로 확인할 수 있습니다.

---

## 관련 저장소

- [Vibly](https://github.com/KOR-Giseong/Vibly) — React Native 앱
- [vibly-admin](https://github.com/KOR-Giseong/vibly-admin) — Next.js 관리자 웹

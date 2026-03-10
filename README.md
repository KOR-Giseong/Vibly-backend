<div align="center">

<img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
<img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" />

# ⚙️ Vibly Backend

### NestJS 기반 RESTful API 서버

*인증, AI 추천, 커플 기능, 크레딧 등 Vibly 서비스 전체 API를 담당합니다*

</div>

---

## 📦 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | NestJS 11 |
| 언어 | TypeScript |
| ORM | Prisma 7 |
| 데이터베이스 | PostgreSQL |
| 캐시 / 큐 | Redis · Bull |
| 인증 | JWT (Access + Refresh Token) · Passport |
| AI | Google Gemini 2.5 Flash |
| 장소 | 카카오 로컬 API · Google Places API |
| 파일 저장 | Cloudflare R2 (S3 호환) |
| 이메일 | Resend |
| 푸시 알림 | Expo Server SDK |
| 보안 | Helmet · Rate Limiting (Throttler) |
| API 문서 | Swagger |
| 배포 | Render |

---

## 🗂 모듈 구조

```
src/
├── auth/           # JWT 인증, 카카오 소셜 로그인, 이메일 인증
├── couple/         # 커플 연결, 데이트 플랜, AI 코스 분석, AI 데이트 비서
├── mood/           # AI 무드 장소 검색 (Gemini + 카카오)
├── place/          # 장소 검색, 북마크, 체크인, 리뷰
├── credit/         # 출석 체크, 크레딧 차감·충전, 구독
├── notification/   # Expo 푸시 알림 발송
├── community/      # 게시글·댓글·좋아요·신고
├── storage/        # Cloudflare R2 파일 업로드
├── prisma/         # Prisma 서비스
└── main.ts
```

---

## ✨ 주요 기능 상세

### 🔐 인증
- 이메일/비밀번호 회원가입·로그인
- 카카오 소셜 로그인
- Access Token + Refresh Token 자동 갱신
- 이메일 인증 (Resend)

### 🤖 AI 무드 검색
- 자연어 쿼리 → Gemini 분석 → 카카오 로컬 API 장소 검색
- 220+ 키워드 빠른 매칭으로 Gemini 호출 최소화
- 취향 바이브 기반 결과 정렬 및 Google Places 사진·평점 보완

### 💑 커플 AI 기능
- **AI 데이트 코스 분석** (15크레딧): 커플 취향·북마크 분석 → Gemini 2단계 호출 → 카카오 실제 장소 기반 하루 타임라인 생성
- **AI 대화형 데이트 비서** (프리미엄): 커플 컨텍스트 기반 맞춤 대화, 이미지 분석 지원
- **AI 타임라인 수정** (2크레딧): 특정 항목만 교체하는 부분 수정

### 💳 크레딧 시스템
- 출석 체크 (연속 7일 보너스)
- AI 기능 사용 시 크레딧 차감
- 파트너 구독 시 50% 할인

---

## 🚀 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env

# 3. DB 마이그레이션
npx prisma migrate dev

# 4. 개발 서버 실행
npm run start:dev
```

### 🔑 주요 환경변수

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

## 📖 API 문서

서버 실행 후 [`/api`](http://localhost:3000/api) 에서 Swagger UI로 전체 엔드포인트를 확인할 수 있습니다.

---

## 🔗 관련 저장소

| 저장소 | 설명 |
|--------|------|
| [Vibly](https://github.com/KOR-Giseong/Vibly) | React Native 앱 |
| [vibly-admin](https://github.com/KOR-Giseong/vibly-admin) | Next.js 관리자 웹 |

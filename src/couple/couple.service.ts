import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { KakaoService } from '../place/kakao.service';

const COUPLE_DATE_AI_COST = 15;
const COUPLE_DATE_AI_REFINE_COST = 2;

@Injectable()
export class CoupleService {
  private readonly logger = new Logger(CoupleService.name);

  constructor(
    private prisma: PrismaService,
    private creditService: CreditService,
    private kakao: KakaoService,
  ) {}

  // ── 내부 헬퍼: 내 현재 활성 커플 조회 ──────────────────────────────────────
  async findMyCouple(userId: string) {
    return this.prisma.couple.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: { select: { id: true, name: true, nickname: true, avatarUrl: true, gender: true, preferredVibes: true, credits: true } },
        user2: { select: { id: true, name: true, nickname: true, avatarUrl: true, gender: true, preferredVibes: true, credits: true } },
      },
    });
  }

  // ── 커플 정보 반환 (getMe에서 사용) ─────────────────────────────────────────
  async getMyCoupleInfo(userId: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) return null;

    const isUser1 = couple.user1Id === userId;
    const partner = isUser1 ? couple.user2 : couple.user1;

    return {
      coupleId: couple.id,
      partnerId: partner.id,
      partnerName: partner.nickname ?? partner.name,
      partnerAvatarUrl: partner.avatarUrl,
      creditShareEnabled: couple.creditShareEnabled,
      anniversaryDate: couple.anniversaryDate,
      createdAt: couple.createdAt,
    };
  }

  // ── 1. 유저 검색 (초대용) ────────────────────────────────────────────────────
  async searchUserForInvite(query: string, requesterId: string) {
    if (!query || query.trim().length < 1) return [];
    return this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: requesterId } },
          { status: 'ACTIVE' },
          { isProfileComplete: true },
          {
            OR: [
              { email: { contains: query.trim(), mode: 'insensitive' } },
              { nickname: { contains: query.trim(), mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, name: true, nickname: true, avatarUrl: true, email: true, gender: true },
      take: 10,
    });
  }

  // ── 2. 초대 전송 ─────────────────────────────────────────────────────────────
  async sendInvitation(senderId: string, receiverId: string, message?: string) {
    const myCouple = await this.findMyCouple(senderId);
    if (myCouple) throw new ConflictException('이미 커플 상태입니다.');

    const theirCouple = await this.findMyCouple(receiverId);
    if (theirCouple) throw new ConflictException('상대방이 이미 커플 상태입니다.');

    const existing = await this.prisma.coupleInvitation.findFirst({
      where: {
        status: 'PENDING',
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });
    if (existing) throw new ConflictException('이미 초대가 진행 중입니다.');

    const [receiver, sender] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: senderId }, select: { name: true, nickname: true } }),
    ]);
    if (!receiver) throw new NotFoundException('사용자를 찾을 수 없어요.');

    const invitation = await this.prisma.coupleInvitation.create({
      data: { senderId, receiverId, message },
    });

    this.prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'COUPLE_INVITE',
        title: '커플 초대가 도착했어요 💕',
        body: `${sender?.nickname ?? sender?.name}님이 커플 등록을 요청했어요.`,
        payload: { invitationId: invitation.id },
      },
    }).catch(() => {});

    return invitation;
  }

  // ── 3. 받은 초대 목록 ────────────────────────────────────────────────────────
  async getReceivedInvitations(userId: string) {
    return this.prisma.coupleInvitation.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: {
        sender: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── 4. 보낸 초대 목록 ────────────────────────────────────────────────────────
  async getSentInvitations(userId: string) {
    return this.prisma.coupleInvitation.findMany({
      where: { senderId: userId, status: 'PENDING' },
      include: {
        receiver: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── 5. 초대 수락/거절 ────────────────────────────────────────────────────────
  async respondToInvitation(invitationId: string, userId: string, accept: boolean) {
    const invitation = await this.prisma.coupleInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation) throw new NotFoundException('초대를 찾을 수 없어요.');
    if (invitation.receiverId !== userId) throw new ForbiddenException('권한이 없어요.');
    if (invitation.status !== 'PENDING') throw new BadRequestException('이미 처리된 초대예요.');

    if (!accept) {
      await this.prisma.coupleInvitation.update({
        where: { id: invitationId },
        data: { status: 'REJECTED', respondedAt: new Date() },
      });
      return { success: true, coupled: false };
    }

    const [senderCouple, receiverCouple] = await Promise.all([
      this.findMyCouple(invitation.senderId),
      this.findMyCouple(invitation.receiverId),
    ]);
    if (senderCouple || receiverCouple) {
      throw new ConflictException('이미 다른 커플 상태가 됐어요.');
    }

    const [, couple] = await this.prisma.$transaction([
      this.prisma.coupleInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      }),
      this.prisma.couple.create({
        data: { user1Id: invitation.senderId, user2Id: invitation.receiverId },
      }),
    ]);

    const receiver = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, nickname: true },
    });
    this.prisma.notification.create({
      data: {
        userId: invitation.senderId,
        type: 'COUPLE_ACCEPT',
        title: '커플이 됐어요! 💕',
        body: `${receiver?.nickname ?? receiver?.name}님이 커플 요청을 수락했어요.`,
        payload: { coupleId: couple.id },
      },
    }).catch(() => {});

    return { success: true, coupled: true, coupleId: couple.id };
  }

  // ── 6. 보낸 초대 취소 ────────────────────────────────────────────────────────
  async cancelInvitation(invitationId: string, userId: string) {
    const invitation = await this.prisma.coupleInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation) throw new NotFoundException('초대를 찾을 수 없어요.');
    if (invitation.senderId !== userId) throw new ForbiddenException('권한이 없어요.');
    if (invitation.status !== 'PENDING') throw new BadRequestException('이미 처리된 초대예요.');

    await this.prisma.coupleInvitation.update({
      where: { id: invitationId },
      data: { status: 'CANCELLED' },
    });
    return { success: true };
  }

  // ── 7. 커플 해제 ─────────────────────────────────────────────────────────────
  async dissolveCouple(userId: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    await this.prisma.couple.update({
      where: { id: couple.id },
      data: { status: 'DISSOLVED', dissolvedAt: new Date() },
    });
    return { success: true };
  }

  // ── 8. 크레딧 공유 토글 ──────────────────────────────────────────────────────
  async toggleCreditShare(userId: string, enabled: boolean) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const updated = await this.prisma.couple.update({
      where: { id: couple.id },
      data: { creditShareEnabled: enabled },
    });
    return { creditShareEnabled: updated.creditShareEnabled };
  }

  // ── 9. 파트너에게 크레딧 전송 ────────────────────────────────────────────────
  async transferCreditsToPartner(userId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('양수 금액만 전송할 수 있어요.');

    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const partnerId = couple.user1Id === userId ? couple.user2Id : couple.user1Id;
    const sender = await this.prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });

    if (!sender || sender.credits < amount) {
      throw new BadRequestException(`크레딧이 부족해요. 보유: ${sender?.credits ?? 0}`);
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { credits: { decrement: amount } } }),
      this.prisma.creditTransaction.create({
        data: { userId, amount: -amount, type: 'COUPLE_CREDIT_SEND', referenceId: partnerId, createdAt: now },
      }),
      this.prisma.user.update({ where: { id: partnerId }, data: { credits: { increment: amount } } }),
      this.prisma.creditTransaction.create({
        data: { userId: partnerId, amount, type: 'COUPLE_CREDIT_SEND', referenceId: userId, createdAt: now },
      }),
    ]);

    const updated = await this.prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
    return { credits: updated?.credits ?? 0, sent: amount };
  }

  // ── 9-1. 커플 크레딧 선물 내역 ────────────────────────────────────────────────
  async getCreditHistory(userId: string, limit = 30) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const partnerId = couple.user1Id === userId ? couple.user2Id : couple.user1Id;

    // amount < 0 인 TX만 가져와서 중복 방지 (선물 1건당 TX 2개 생성)
    const txs = await this.prisma.creditTransaction.findMany({
      where: {
        userId: { in: [userId, partnerId] },
        type: 'COUPLE_CREDIT_SEND',
        amount: { lt: 0 },
      },
      include: {
        user: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return txs.map((tx) => ({
      id: tx.id,
      senderId: tx.userId,
      senderName: tx.user.nickname ?? tx.user.name,
      senderAvatarUrl: tx.user.avatarUrl ?? null,
      amount: Math.abs(tx.amount),
      createdAt: (tx.createdAt as Date).toISOString(),
      isMine: tx.userId === userId,
    }));
  }
  async getPartnerBookmarks(userId: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const partnerId = couple.user1Id === userId ? couple.user2Id : couple.user1Id;
    const host = process.env.SERVER_URL ?? 'http://localhost:3000';

    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId: partnerId },
      include: {
        place: {
          select: {
            id: true, name: true, category: true, address: true,
            lat: true, lng: true, rating: true, reviewCount: true,
            images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
            tags: { select: { tag: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Place 구조로 평탄화해서 반환
    return bookmarks.map((b) => {
      const rawUrl = b.place.images?.[0]?.url ?? null;
      const imageUrl = rawUrl
        ? (rawUrl.startsWith('http') ? rawUrl : `${host}${rawUrl}`)
        : null;
      return {
        id: b.place.id,
        name: b.place.name,
        category: b.place.category,
        address: b.place.address,
        lat: b.place.lat,
        lng: b.place.lng,
        rating: b.place.rating,
        reviewCount: b.place.reviewCount,
        imageUrl,
        tags: b.place.tags?.map((t: any) => t.tag?.name).filter(Boolean) ?? [],
      };
    });
  }

  // ── 11. 파트너 프로필 ────────────────────────────────────────────────────────
  async getPartnerProfile(userId: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const partnerId = couple.user1Id === userId ? couple.user2Id : couple.user1Id;
    const partner = await this.prisma.user.findUnique({
      where: { id: partnerId },
      select: {
        id: true, name: true, nickname: true, avatarUrl: true,
        gender: true, preferredVibes: true, credits: true, createdAt: true,
        _count: { select: { checkIns: true, bookmarks: true, reviews: true } },
      },
    });
    if (!partner) throw new NotFoundException('파트너 정보를 찾을 수 없어요.');

    return {
      id: partner.id,
      name: partner.name,
      nickname: partner.nickname,
      avatarUrl: partner.avatarUrl,
      gender: partner.gender,
      preferredVibes: partner.preferredVibes,
      credits: partner.credits,
      stats: {
        checkinCount: partner._count.checkIns,
        bookmarkCount: partner._count.bookmarks,
        reviewCount: partner._count.reviews,
      },
    };
  }

  // ── 12. 데이트 플랜 목록 ─────────────────────────────────────────────────────
  async getDatePlans(userId: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    return this.prisma.datePlan.findMany({
      where: { coupleId: couple.id },
      orderBy: { dateAt: 'desc' },
    });
  }

  // ── 13. 데이트 플랜 생성 ─────────────────────────────────────────────────────
  async createDatePlan(userId: string, data: {
    title: string;
    dateAt: Date;
    memo?: string;
    placeIds?: string[];
  }) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    return this.prisma.datePlan.create({
      data: {
        coupleId: couple.id,
        title: data.title,
        dateAt: data.dateAt,
        memo: data.memo,
        placeIds: data.placeIds ?? [],
      },
    });
  }

  // ── 14. 데이트 플랜 수정 ─────────────────────────────────────────────────────
  async updateDatePlan(userId: string, planId: string, data: {
    title?: string;
    dateAt?: Date;
    memo?: string;
    status?: 'PLANNED' | 'COMPLETED' | 'CANCELLED';
    placeIds?: string[];
  }) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const plan = await this.prisma.datePlan.findUnique({ where: { id: planId } });
    if (!plan || plan.coupleId !== couple.id) throw new NotFoundException('데이트 플랜을 찾을 수 없어요.');

    return this.prisma.datePlan.update({ where: { id: planId }, data });
  }

  // ── 15. 데이트 플랜 삭제 ─────────────────────────────────────────────────────
  async deleteDatePlan(userId: string, planId: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const plan = await this.prisma.datePlan.findUnique({ where: { id: planId } });
    if (!plan || plan.coupleId !== couple.id) throw new NotFoundException('데이트 플랜을 찾을 수 없어요.');

    await this.prisma.datePlan.delete({ where: { id: planId } });
    return { success: true };
  }

  // ── 16-0. 내부 헬퍼: Gemini로 지역 + 장소 키워드 추출 ──────────────────────────
  private async extractDateKeywords(
    context: string,
    userNote?: string,
  ): Promise<{ region: string; keywords: string[] }> {
    // ── userNote에서 지역명을 코드 레벨로 먼저 추출 ──────────────────────────
    // Gemini에게 맡기면 북마크(context)에 끌려가므로, 명시적 지역명은 직접 감지
    const REGION_PATTERNS: [RegExp, string][] = [
      [/서울숲/,           '서울숲'],
      [/성수동?/,          '성수동'],
      [/한남동?/,          '한남동'],
      [/이태원/,           '이태원'],
      [/홍대|홍익대/,      '홍대'],
      [/합정/,             '합정'],
      [/강남역?/,          '강남'],
      [/신사동?|가로수길/, '가로수길'],
      [/압구정/,           '압구정'],
      [/청담/,             '청담'],
      [/여의도/,           '여의도'],
      [/한강공원|반포/,    '반포한강공원'],
      [/망원/,             '망원동'],
      [/마포/,             '마포'],
      [/종로|인사동/,      '인사동'],
      [/북촌|삼청동/,      '북촌'],
      [/연남동?/,          '연남동'],
      [/을지로/,           '을지로'],
      [/익선동/,           '익선동'],
      [/뚝섬/,             '뚝섬'],
      [/건대입구?|건대/,   '건대입구'],
      [/신촌/,             '신촌'],
      [/노원/,             '노원'],
      [/판교/,             '판교'],
      [/수원/,             '수원'],
      [/분당/,             '분당'],
      [/부천/,             '부천'],
      [/인천/,             '인천'],
    ];

    let forcedRegion: string | null = null;
    if (userNote) {
      for (const [pattern, name] of REGION_PATTERNS) {
        if (pattern.test(userNote)) {
          forcedRegion = name;
          break;
        }
      }
    }

    // 지역이 코드 레벨에서 확정됐으면 Gemini는 키워드 추출만 담당
    const prompt = forcedRegion
      ? `아래 커플 정보와 요청사항을 분석해서 카카오 장소 검색에 최적화된 키워드를 추출하세요.

[요청사항 — 최우선 반영]
${userNote}

[커플 컨텍스트 — 취향 파악용]
${context}

지역은 반드시 "${forcedRegion}"으로 고정하세요.
다음 JSON만 반환 (다른 텍스트·마크다운 없이):
{
  "region": "${forcedRegion}",
  "keywords": ["장소 유형 4~5개 (각 항목은 유형 한 단어, 예: '브런치 카페', '이탈리안 레스토랑', '전시회', '한강공원', '루프탑 바') — 요청사항의 분위기를 우선 반영"]
}`
      : `아래 커플 정보와 요청사항을 분석해서 카카오 장소 검색에 최적화된 키워드를 추출하세요.

${userNote ? `[요청사항 — 최우선 반영]\n${userNote}\n\n` : ''}[커플 컨텍스트 — 취향 파악용]
${context}

[중요 규칙]
- 요청사항에 지역명이 있으면 반드시 그 지역을 region으로 사용하세요 (컨텍스트 무시)
- 요청사항에 지역이 없으면 컨텍스트의 주요 방문 지역을 사용하세요
- 지역 정보가 전혀 없으면 '홍대'를 기본값으로 사용하세요

다음 JSON만 반환 (다른 텍스트·마크다운 없이):
{
  "region": "구체적인 지역명 (예: 홍대, 강남, 성수동, 이태원, 여의도, 서울숲)",
  "keywords": ["장소 유형 4~5개 (각 항목은 '유형' 한 단어, 예: '브런치 카페', '이탈리안 레스토랑', '전시회', '한강공원', '루프탑 바')"]
}`;
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 300, responseMimeType: 'application/json' },
          }),
        },
      );
      const raw = await res.json();
      const parts1 = raw.candidates?.[0]?.content?.parts ?? [];
      const text = (parts1.find((p: any) => !p.thought && p.text) ?? parts1[0])?.text ?? '';
      this.logger.log(`[AI날짜] 키워드 추출 응답(앞80): ${text.slice(0, 80)}`);
      const parsed = JSON.parse(text);
      if (parsed.region && Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
        // forcedRegion이 있으면 Gemini 응답 region을 무시하고 강제 고정
        const finalRegion = forcedRegion ?? parsed.region;
        this.logger.log(`[AI날짜] 키워드 추출 성공 → 지역: ${finalRegion}${forcedRegion ? ' (강제지정)' : ''}, 키워드: ${parsed.keywords.join(', ')}`);
        return { region: finalRegion, keywords: parsed.keywords.slice(0, 5) };
      }
      this.logger.warn('[AI날짜] 키워드 추출 필드 누락, fallback 사용');
    } catch (e) {
      this.logger.error('[AI날짜] extractDateKeywords 에러:', e?.message);
    }
    return { region: forcedRegion ?? '홍대', keywords: ['브런치 카페', '레스토랑', '전시', '공원', '루프탑 바'] };
  }

  // ── 16-0b. 내부 헬퍼: 카카오 실장소 검색 ──────────────────────────────────────
  private async searchKakaoForDate(
    region: string,
    keywords: string[],
    limitPerKeyword = 3,
  ): Promise<Array<{ id: string; name: string; address: string; category: string }>> {
    const resultSets = await Promise.allSettled(
      keywords.map((kw) =>
        this.kakao.searchByKeyword(`${region} ${kw}`, undefined, undefined, 1, 'accuracy', limitPerKeyword),
      ),
    );
    const seen = new Set<string>();
    const merged: Array<{ id: string; name: string; address: string; category: string }> = [];
    for (const r of resultSets) {
      if (r.status !== 'fulfilled') {
        this.logger.warn('[AI날짜] 카카오 검색 일부 실패:', (r as PromiseRejectedResult).reason?.message);
        continue;
      }
      for (const p of r.value) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          merged.push({ id: p.id, name: p.name, address: p.address, category: p.categoryLabel ?? p.category });
        }
      }
    }
    this.logger.log(`[AI날짜] 카카오 실장소 검색 결과: ${merged.length}개 → ${merged.map(p => p.name).join(', ')}`);
    return merged;
  }

  // ── 16. AI 데이트 분석 (15크레딧) ────────────────────────────────────────────
  async aiDateAnalysis(userId: string, userNote?: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const creditsRemaining = await this.creditService.spend(userId, COUPLE_DATE_AI_COST, 'COUPLE_DATE_AI' as any, couple.id);

    const partnerId = couple.user1Id === userId ? couple.user2Id : couple.user1Id;

    const [completedPlans, plannedPlans, myBookmarks, partnerBookmarks] = await Promise.all([
      this.prisma.datePlan.findMany({
        where: { coupleId: couple.id, status: 'COMPLETED' },
        orderBy: { dateAt: 'desc' },
        take: 10,
      }),
      this.prisma.datePlan.findMany({
        where: { coupleId: couple.id, status: 'PLANNED' },
        orderBy: { dateAt: 'asc' },
        take: 5,
      }),
      this.prisma.bookmark.findMany({
        where: { userId },
        include: { place: { select: { name: true, category: true, address: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.bookmark.findMany({
        where: { userId: partnerId },
        include: { place: { select: { name: true, category: true, address: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const plansText = completedPlans.length === 0
      ? '아직 완료된 데이트 기록이 없습니다.'
      : completedPlans.map(p => `- ${p.title} (${new Date(p.dateAt).toLocaleDateString('ko-KR')})`).join('\n');

    const myBookmarkText = myBookmarks.length === 0
      ? '없음'
      : myBookmarks.map(b => `- ${b.place.name} (${b.place.category ?? '기타'}, ${b.place.address ?? ''})`).join('\n');

    const partnerBookmarkText = partnerBookmarks.length === 0
      ? '없음'
      : partnerBookmarks.map(b => `- ${b.place.name} (${b.place.category ?? '기타'}, ${b.place.address ?? ''})`).join('\n');

    const plannedPlansText = plannedPlans.length === 0
      ? '없음'
      : plannedPlans.map(p => `- ${p.title} (예정: ${new Date(p.dateAt).toLocaleDateString('ko-KR')})`).join('\n');

    const context = `완료된 데이트: ${plansText}\n내 북마크: ${myBookmarkText}\n파트너 북마크: ${partnerBookmarkText}`;

    // ① Gemini 1차: 지역 + 장소 키워드 추출
    const { region, keywords } = await this.extractDateKeywords(context, userNote);
    this.logger.log(`[AI날짜] 지역: ${region}, 키워드: ${keywords.join(', ')}`);

    // ② 카카오로 실제 장소 검색 (키워드별 병렬)
    const realPlaces = await this.searchKakaoForDate(region, keywords, 3);
    this.logger.log(`[AI날짜] 실장소 ${realPlaces.length}개 확보`);

    // ③ 실제 장소 목록 텍스트 구성
    const placesListText = realPlaces.length === 0
      ? '검색된 실제 장소가 없습니다. 장소 유형으로 대체해주세요.'
      : realPlaces.map((p, i) => `${i + 1}. [${p.id}] ${p.name} | ${p.address} | ${p.category}`).join('\n');

    // ④ Gemini 2차: 실제 장소 기반 타임라인 구성
    const prompt = `당신은 커플 전용 하루 데이트 플래너입니다.
아래 카카오로 검색한 실제 장소들을 최대한 활용해서 자연스러운 하루 코스를 만들어주세요.
${userNote ? `\n[커플 요청사항 — 최우선 반영]\n${userNote}\n` : ''}
[지역] ${region}

[카카오 실제 장소 후보]
${placesListText}

[커플 데이트 기록]
${plansText}

[예정된 플랜]
${plannedPlansText}

[내 북마크 — 취향 참고용]
${myBookmarkText}

[파트너 북마크 — 취향 참고용]
${partnerBookmarkText}

[규칙]
- 요청사항에 지역이나 분위기가 명시된 경우 반드시 최우선으로 반영하세요
- 타임라인 5개 항목 중 최소 4개는 위 실제 장소 후보에서 선택하세요
- place 필드에 실제 장소명을 그대로, address 필드에 실제 주소, kakaoId에 [ ] 안의 ID를 넣으세요
- 실제 장소가 부족한 경우에만 place에 장소 유형을 쓰고 address·kakaoId는 null로 하세요
- 동선이 자연스럽도록 가까운 장소끼리 묶어 배치하세요 (오전→점심→오후→저녁→야간)

다음 JSON 형식으로만 응답하세요 (추가 텍스트 없이):
{
  "analysis": "커플 취향 분석 및 이번 코스 추천 이유 (2-3문장, 한국어)",
  "region": "${region}",
  "timeline": [
    { "time": "11:00", "emoji": "☕", "place": "실제 장소명", "address": "실제 주소", "kakaoId": "카카오ID", "activity": "활동 설명", "tip": "한 줄 팁" },
    { "time": "13:00", "emoji": "🍜", "place": "실제 장소명", "address": "실제 주소", "kakaoId": "카카오ID", "activity": "활동 설명", "tip": "한 줄 팁" },
    { "time": "15:00", "emoji": "🎨", "place": "실제 장소명", "address": "실제 주소", "kakaoId": "카카오ID", "activity": "활동 설명", "tip": "한 줄 팁" },
    { "time": "18:00", "emoji": "🌅", "place": "실제 장소명", "address": "실제 주소", "kakaoId": "카카오ID", "activity": "활동 설명", "tip": "한 줄 팁" },
    { "time": "20:00", "emoji": "🍷", "place": "실제 장소명", "address": "실제 주소", "kakaoId": "카카오ID", "activity": "활동 설명", "tip": "한 줄 팁" }
  ]
}`;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 4096, responseMimeType: 'application/json' },
          }),
        },
      );
      const raw = await response.json();
      if (!raw.candidates?.length) throw new Error(raw.error?.message ?? 'Gemini API no candidates');
      const parts2 = raw.candidates[0]?.content?.parts ?? [];
      const text = (parts2.find((p: any) => !p.thought && p.text) ?? parts2[0])?.text ?? '';
      const parsed = JSON.parse(text);
      if (!parsed?.analysis) throw new Error('Gemini returned no analysis');
      this.logger.log(`[AI날짜] Gemini 타임라인 생성 완료 → ${parsed.timeline?.length}개 항목, 실장소 포함: ${parsed.timeline?.filter((t: any) => t.kakaoId).length}개`);
      return { ...parsed, creditsRemaining };
    } catch (e) {
      this.logger.error('[AI날짜] Gemini 2차 호출 실패:', e?.message);
      return {
        creditsRemaining,
        analysis: '데이트 기록이 쌓일수록 더 정확한 분석이 가능해요. 북마크와 플랜을 채워갈수록 더 맞춤 일정을 드릴게요!',
        region,
        timeline: [
          { time: '11:00', emoji: '☕', place: '감성 카페', address: null, kakaoId: null, activity: '브런치 카페 데이트', tip: '가볍게 이야기 나누며 하루를 시작해요' },
          { time: '13:00', emoji: '🍜', place: '맛집', address: null, kakaoId: null, activity: '점심 식사', tip: '두 사람이 좋아하는 음식을 찾아가봐요' },
          { time: '15:00', emoji: '🎨', place: '전시관 / 문화공간', address: null, kakaoId: null, activity: '문화 활동', tip: '새로운 경험을 함께 나눠요' },
          { time: '18:00', emoji: '🌅', place: '공원 / 강변', address: null, kakaoId: null, activity: '저녁 산책', tip: '노을을 보며 여유로운 시간을 보내요' },
          { time: '20:00', emoji: '🍷', place: '루프탑 / 분위기 좋은 식당', address: null, kakaoId: null, activity: '저녁 식사', tip: '하루를 마무리하는 특별한 저녁' },
        ],
      };
    }
  }

  // ── 16-2. AI 타임라인 수정 (2크레딧) ──────────────────────────────────────────
  async aiRefineTimeline(userId: string, timeline: any[], feedback: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const creditsRemaining = await this.creditService.spend(userId, COUPLE_DATE_AI_REFINE_COST, 'COUPLE_DATE_AI' as any, couple.id);

    // 기존 타임라인에서 지역 추출 (주소 있는 항목 우선)
    const regionFromTimeline = timeline
      .map(t => t.address)
      .filter(Boolean)
      .map((addr: string) => addr.split(' ').slice(1, 3).join(' '))
      .find(Boolean) ?? '해당 지역';

    // 피드백 기반 카카오 검색 (실제 대안 장소 확보)
    const placeCandidates = await this.searchKakaoForDate(regionFromTimeline, [feedback], 5);

    const placesListText = placeCandidates.length === 0
      ? '검색된 대안 장소가 없습니다.'
      : placeCandidates.map((p, i) => `${i + 1}. [${p.id}] ${p.name} | ${p.address} | ${p.category}`).join('\n');

    const timelineText = timeline.map(t =>
      `${t.time} ${t.emoji} ${t.place}${t.address ? ` (${t.address})` : ''} - ${t.activity}`
    ).join('\n');

    const prompt = `커플의 하루 데이트 타임라인을 수정 요청에 맞게 업데이트해주세요.

[현재 타임라인]
${timelineText}

[수정 요청]
${feedback}

[대안으로 쓸 수 있는 실제 장소 후보 (카카오 검색 결과)]
${placesListText}

[규칙]
- 수정 요청과 관련 없는 항목은 반드시 그대로 유지하세요
- 변경이 필요한 항목은 가능하면 위 실제 장소 후보에서 선택하세요
- 실제 장소를 선택했다면 place에 실제 장소명, address에 실제 주소, kakaoId에 [ ] 안의 ID를 사용하세요
- 기존 항목의 address·kakaoId도 그대로 유지하세요

다음 JSON만 반환 (다른 텍스트 없이):
{
  "analysis": "수정된 내용 요약 (1-2문장, 한국어)",
  "timeline": [
    { "time": "HH:MM", "emoji": "이모지", "place": "장소명", "address": "주소 또는 null", "kakaoId": "ID 또는 null", "activity": "활동 설명", "tip": "한 줄 팁" }
  ]
}`;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 3072, responseMimeType: 'application/json' },
          }),
        },
      );
      const raw = await response.json();
      if (!raw.candidates?.length) throw new Error(raw.error?.message ?? 'Gemini API no candidates');
      const parts3 = raw.candidates[0]?.content?.parts ?? [];
      const text = (parts3.find((p: any) => !p.thought && p.text) ?? parts3[0])?.text ?? '';
      const parsed = JSON.parse(text);
      if (!parsed?.timeline) throw new Error('Gemini returned no timeline');
      return { ...parsed, creditsRemaining };
    } catch {
      return { creditsRemaining, analysis: '수정에 실패했어요. 다시 시도해주세요.', timeline };
    }
  }

  // ── 17. 추억 사진 목록 ───────────────────────────────────────────────────────
  async getMemories(userId: string, page = 1, limit = 20) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.coupleMemory.findMany({
        where: { coupleId: couple.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.coupleMemory.count({ where: { coupleId: couple.id } }),
    ]);

    const host = process.env.SERVER_URL ?? 'http://localhost:3000';
    const itemsWithUrl = items.map((item) => ({
      ...item,
      imageUrl: item.imageUrl.startsWith('http') ? item.imageUrl : `${host}${item.imageUrl}`,
    }));

    return { items: itemsWithUrl, total, page, hasNext: skip + items.length < total };
  }

  // ── 18. 추억 사진 업로드 ─────────────────────────────────────────────────────
  async uploadMemory(userId: string, data: { base64: string; caption?: string; takenAt?: Date }) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    // 무료 유저는 추억 사진 100장 제한
    const subscribed = await this.creditService.isSubscribed(userId);
    if (!subscribed) {
      const count = await this.prisma.coupleMemory.count({
        where: { coupleId: couple.id, uploaderId: userId },
      });
      if (count >= 100) {
        throw new ForbiddenException('무료 플랜은 추억 사진을 100장까지 저장할 수 있어요. 프리미엄으로 업그레이드해보세요!');
      }
    }

    const fs = await import('fs/promises');
    const path = await import('path');
    // expo-image-picker는 data URI 없이 raw base64 반환 → PNG는 'iVBORw' 로 시작
    const isPng = data.base64.startsWith('iVBORw') || data.base64.startsWith('data:image/png');
    const ext = isPng ? 'png' : 'jpg';
    const filename = `memory-${couple.id}-${userId}-${Date.now()}.${ext}`;
    const dir = path.join(process.cwd(), 'public', 'memories');
    await fs.mkdir(dir, { recursive: true });

    const base64Data = data.base64.replace(/^data:image\/\w+;base64,/, '');
    await fs.writeFile(path.join(dir, filename), Buffer.from(base64Data, 'base64'));

    // 경로만 저장 (호스트 없이) → getMemories에서 SERVER_URL 붙여서 반환
    const imageUrl = `/public/memories/${filename}`;

    return this.prisma.coupleMemory.create({
      data: {
        coupleId: couple.id,
        uploaderId: userId,
        imageUrl,
        caption: data.caption,
        takenAt: data.takenAt,
      },
    });
  }

  // ── 19. 추억 사진 삭제 ───────────────────────────────────────────────────────
  async deleteMemory(userId: string, memoryId: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const memory = await this.prisma.coupleMemory.findUnique({ where: { id: memoryId } });
    if (!memory || memory.coupleId !== couple.id) throw new NotFoundException('추억을 찾을 수 없어요.');
    if (memory.uploaderId !== userId) throw new ForbiddenException('본인이 업로드한 사진만 삭제할 수 있어요.');

    try {
      const path = await import('path');
      const fs = await import('fs/promises');
      const filename = path.basename(memory.imageUrl);
      await fs.unlink(path.join(process.cwd(), 'public', 'memories', filename));
    } catch {}

    await this.prisma.coupleMemory.delete({ where: { id: memoryId } });
    return { success: true };
  }

  // ── 20. 기념일 설정 ──────────────────────────────────────────────────────────
  async setAnniversaryDate(userId: string, anniversaryDate: Date) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const updated = await this.prisma.couple.update({
      where: { id: couple.id },
      data: { anniversaryDate },
    });
    return { anniversaryDate: updated.anniversaryDate };
  }

  // ── 어드민 ────────────────────────────────────────────────────────────────────

  async adminGetCouples(adminId: string, page = 1, limit = 30, status?: string) {
    await this.assertAdmin(adminId);

    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [items, total] = await Promise.all([
      this.prisma.couple.findMany({
        where,
        include: {
          user1: { select: { id: true, name: true, nickname: true, email: true, avatarUrl: true } },
          user2: { select: { id: true, name: true, nickname: true, email: true, avatarUrl: true } },
          _count: { select: { datePlans: true, memories: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.couple.count({ where }),
    ]);

    return { items, total, page, hasNext: skip + items.length < total };
  }

  async adminDissolveCouple(adminId: string, coupleId: string) {
    await this.assertAdmin(adminId);

    const couple = await this.prisma.couple.findUnique({ where: { id: coupleId } });
    if (!couple) throw new NotFoundException('커플을 찾을 수 없어요.');

    await this.prisma.couple.update({
      where: { id: coupleId },
      data: { status: 'DISSOLVED', dissolvedAt: new Date() },
    });
    return { success: true };
  }

  // ── 21. 유저 신고 ─────────────────────────────────────────────────────────────
  async reportUser(reporterId: string, dto: { reportedId: string; reason: string; detail?: string }) {
    if (reporterId === dto.reportedId) throw new BadRequestException('자기 자신을 신고할 수 없어요.');
    const reported = await this.prisma.user.findUnique({ where: { id: dto.reportedId } });
    if (!reported) throw new NotFoundException('사용자를 찾을 수 없어요.');

    return this.prisma.userReport.create({
      data: {
        reporterId,
        reportedId: dto.reportedId,
        reason: dto.reason as any,
        detail: dto.detail,
      },
    });
  }

  // ── 어드민: 유저 신고 목록 ────────────────────────────────────────────────────
  async adminGetUserReports(adminId: string, page = 1, limit = 30, onlyUnresolved = false) {
    await this.assertAdmin(adminId);

    const where = onlyUnresolved ? { isResolved: false } : {};
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.userReport.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, nickname: true } },
          reported:  { select: { id: true, name: true, nickname: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userReport.count({ where }),
    ]);

    return { items, total, page, hasNext: skip + items.length < total };
  }

  // ── 어드민: 유저 신고 처리 ────────────────────────────────────────────────────
  async adminResolveUserReport(adminId: string, reportId: string) {
    await this.assertAdmin(adminId);
    await this.prisma.userReport.update({
      where: { id: reportId },
      data: { isResolved: true },
    });
    return { success: true };
  }

  // ── 채팅: 메시지 목록 ────────────────────────────────────────────────────────
  async getMessages(userId: string, page = 1, limit = 50) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.coupleMessage.findMany({
        where: { coupleId: couple.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.coupleMessage.count({ where: { coupleId: couple.id } }),
    ]);

    const host = process.env.SERVER_URL ?? 'http://localhost:3000';
    const itemsWithUrl = items.map((item) => ({
      ...item,
      imageUrl: item.imageUrl
        ? (item.imageUrl.startsWith('http') ? item.imageUrl : `${host}${item.imageUrl}`)
        : null,
    }));

    return { items: itemsWithUrl, total, page, hasNext: skip + items.length < total };
  }

  // ── 채팅: 메시지 전송 ────────────────────────────────────────────────────────
  async sendMessage(userId: string, dto: { type: 'TEXT' | 'IMAGE' | 'EMOJI'; text?: string; imageBase64?: string; emoji?: string }) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    let imageUrl: string | null = null;
    if (dto.type === 'IMAGE' && dto.imageBase64) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const isPng = dto.imageBase64.startsWith('iVBORw') || dto.imageBase64.startsWith('data:image/png');
      const ext = isPng ? 'png' : 'jpg';
      const filename = `chat-${couple.id}-${userId}-${Date.now()}.${ext}`;
      const dir = path.join(process.cwd(), 'public', 'chat');
      await fs.mkdir(dir, { recursive: true });
      const base64Data = dto.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      await fs.writeFile(path.join(dir, filename), Buffer.from(base64Data, 'base64'));
      imageUrl = `/public/chat/${filename}`;
    }

    const message = await this.prisma.coupleMessage.create({
      data: {
        coupleId: couple.id,
        senderId: userId,
        type: dto.type as any,
        text: dto.text ?? null,
        imageUrl,
        emoji: dto.emoji ?? null,
      },
    });

    const host = process.env.SERVER_URL ?? 'http://localhost:3000';
    return {
      ...message,
      imageUrl: imageUrl ? `${host}${imageUrl}` : null,
    };
  }

  // ── 채팅: 읽음 처리 ──────────────────────────────────────────────────────────
  async markMessagesRead(userId: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) return { updated: 0 };

    const result = await this.prisma.coupleMessage.updateMany({
      where: {
        coupleId: couple.id,
        senderId: { not: userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  // ── AI 대화형 데이트 비서 (프리미엄 + 커플 전용) ──────────────────────────────
  async aiDateChat(
    userId: string,
    messages: Array<{ role: 'user' | 'model'; text: string }>,
    lat?: number,
    lng?: number,
  ) {
    // 프리미엄 체크
    const subscribed = await this.creditService.isSubscribed(userId);
    if (!subscribed) {
      throw new ForbiddenException('AI 데이트 비서는 프리미엄 기능이에요. 구독 후 이용해주세요!');
    }

    // 커플 체크
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 등록 후 이용할 수 있어요.');

    const systemPrompt = `당신은 커플의 데이트를 도와주는 AI 비서입니다.
한국어로 친근하고 따뜻하게 대화하세요.
장소 추천이 필요하면 구체적인 장소 유형이나 키워드를 제안해주세요.
응답은 200자 이내로 간결하게 해주세요.`;

    // Gemini contents 형식으로 변환
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: '안녕하세요! 오늘 데이트 계획을 도와드릴게요 💕' }] },
      ...messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      })),
    ];

    let responseText = '죄송해요, 잠시 후 다시 시도해주세요.';
    let places: any[] = [];

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.9, maxOutputTokens: 400 },
          }),
        },
      );
      const data = await res.json() as any;
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? responseText;

      // 장소 추천 키워드 감지 → 카카오 검색
      if (lat != null && lng != null && responseText.includes('추천')) {
        const keywordMatch = responseText.match(/["「]([^"」]+)["」]/);
        if (keywordMatch) {
          try {
            places = await this.kakao.searchByKeyword(keywordMatch[1], lat, lng, 1, 'distance', 3);
          } catch {
            // 카카오 검색 실패 무시
          }
        }
      }
    } catch (e) {
      this.logger.error('AI 데이트 비서 오류', e);
    }

    return { text: responseText, places: places.length > 0 ? places : undefined };
  }

  private async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
    if (!user?.isAdmin) throw new ForbiddenException('관리자 권한이 필요해요.');
  }
}

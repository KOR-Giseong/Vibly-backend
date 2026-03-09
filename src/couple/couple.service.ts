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
import { NotificationService } from '../notification/notification.service';
import { R2Service } from '../storage/r2.service';

const COUPLE_DATE_AI_COST = 15;
const COUPLE_DATE_AI_REFINE_COST = 2;

@Injectable()
export class CoupleService {
  private readonly logger = new Logger(CoupleService.name);

  constructor(
    private prisma: PrismaService,
    private creditService: CreditService,
    private kakao: KakaoService,
    private notificationService: NotificationService,
    private r2: R2Service,
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

    const invitation = await this.prisma.coupleInvitation.upsert({
      where: { senderId_receiverId: { senderId, receiverId } },
      create: { senderId, receiverId, message },
      update: { status: 'PENDING', message: message ?? null, respondedAt: null },
    });

    this.notificationService
      .send(
        receiverId,
        'COUPLE_INVITE',
        '커플 초대가 도착했어요 💕',
        `${sender?.nickname ?? sender?.name}님이 커플 등록을 요청했어요.`,
        { invitationId: invitation.id },
      )
      .catch(() => {});

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

    const couple = await this.prisma.$transaction(async (tx) => {
      await tx.coupleInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      // 이전에 커플이었다가 해제된 경우 재활성화 (unique 제약 충돌 방지)
      const existingCouple = await tx.couple.findFirst({
        where: {
          OR: [
            { user1Id: invitation.senderId, user2Id: invitation.receiverId },
            { user1Id: invitation.receiverId, user2Id: invitation.senderId },
          ],
        },
      });

      if (existingCouple) {
        return tx.couple.update({
          where: { id: existingCouple.id },
          data: { status: 'ACTIVE', dissolvedAt: null, anniversaryDate: null, creditShareEnabled: false },
        });
      } else {
        return tx.couple.create({
          data: { user1Id: invitation.senderId, user2Id: invitation.receiverId },
        });
      }
    });

    const receiver = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, nickname: true },
    });
    this.notificationService
      .send(
        invitation.senderId,
        'COUPLE_ACCEPT',
        '커플이 됐어요! 💕',
        `${receiver?.nickname ?? receiver?.name}님이 커플 요청을 수락했어요.`,
        { coupleId: couple.id },
      )
      .catch(() => {});

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

    // 구독자 → 비구독 파트너 선물: 주 100크레딧 한도
    const [senderSubscribed, partnerSubscribed] = await Promise.all([
      this.creditService.isSubscribed(userId),
      this.creditService.isSubscribed(partnerId),
    ]);
    if (senderSubscribed && !partnerSubscribed) {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      // 7일 전 vs 현재 커플 생성 시각 중 더 최근 기준으로 집계 (이전 커플 시절 내역 오염 방지)
      const since = couple.createdAt > weekAgo ? couple.createdAt : weekAgo;
      const weeklyAgg = await this.prisma.creditTransaction.aggregate({
        where: { userId, type: 'COUPLE_CREDIT_SEND', amount: { lt: 0 }, createdAt: { gte: since } },
        _sum: { amount: true },
      });
      const sentThisWeek = Math.abs(weeklyAgg._sum.amount ?? 0);
      if (sentThisWeek + amount > 100) {
        throw new BadRequestException(
          `이번 주 선물 한도를 초과해요. (한도 100크레딧, 이미 ${sentThisWeek}크레딧 선물함)`,
        );
      }
    }

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
    // 현재 커플 createdAt 이후 거래만 필터 → 재결합 시 이전 내역 노출 방지
    const txs = await this.prisma.creditTransaction.findMany({
      where: {
        userId: { in: [userId, partnerId] },
        type: 'COUPLE_CREDIT_SEND',
        amount: { lt: 0 },
        createdAt: { gte: couple.createdAt },
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
    const [partner, isPremium] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: partnerId },
        select: {
          id: true, name: true, nickname: true, avatarUrl: true,
          gender: true, preferredVibes: true, credits: true, createdAt: true,
          _count: { select: { checkIns: true, bookmarks: true, reviews: true } },
        },
      }),
      this.creditService.isSubscribed(partnerId),
    ]);
    if (!partner) throw new NotFoundException('파트너 정보를 찾을 수 없어요.');

    return {
      id: partner.id,
      name: partner.name,
      nickname: partner.nickname,
      avatarUrl: partner.avatarUrl,
      gender: partner.gender,
      preferredVibes: partner.preferredVibes,
      credits: partner.credits,
      isPremium,
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
      // 서울 주요 지역
      [/서울숲/,              '서울숲'],
      [/성수동?/,             '성수동'],
      [/한남동?/,             '한남동'],
      [/이태원/,              '이태원'],
      [/홍대|홍익대/,         '홍대'],
      [/합정/,                '합정'],
      [/강남역?/,             '강남'],
      [/신사동?|가로수길/,    '가로수길'],
      [/압구정/,              '압구정'],
      [/청담/,                '청담'],
      [/여의도/,              '여의도'],
      [/한강공원|반포/,       '반포한강공원'],
      [/망원/,                '망원동'],
      [/마포/,                '마포'],
      [/종로|인사동/,         '인사동'],
      [/북촌|삼청동/,         '북촌'],
      [/연남동?/,             '연남동'],
      [/을지로/,              '을지로'],
      [/익선동/,              '익선동'],
      [/뚝섬/,                '뚝섬'],
      [/건대입구?|건대/,      '건대입구'],
      [/신촌/,                '신촌'],
      [/노원/,                '노원'],
      [/강동/,                '강동'],
      [/잠실/,                '잠실'],
      [/명동/,                '명동'],
      [/동대문/,              '동대문'],
      [/상암/,                '상암'],
      // 경기
      [/판교/,                '판교'],
      [/수원/,                '수원'],
      [/분당/,                '분당'],
      [/부천/,                '부천'],
      [/일산/,                '일산'],
      [/의정부/,              '의정부'],
      [/안양/,                '안양'],
      [/성남/,                '성남'],
      [/용인/,                '용인'],
      [/화성|동탄/,           '동탄'],
      [/광명/,                '광명'],
      [/구리/,                '구리'],
      // 인천
      [/인천|송도/,           '인천 송도'],
      [/부평/,                '인천 부평'],
      // 부산
      [/해운대/,              '해운대'],
      [/광안리/,              '광안리'],
      [/서면/,                '부산 서면'],
      [/남포동|부산역/,       '부산 남포동'],
      [/기장/,                '부산 기장'],
      [/부산(?!역)/,          '부산'],
      // 대구
      [/동성로/,              '동성로'],
      [/수성못/,              '수성못'],
      [/대구/,                '대구'],
      // 광주
      [/충장로/,              '충장로'],
      [/광주/,                '광주'],
      // 대전
      [/둔산동?/,             '대전 둔산'],
      [/대전/,                '대전'],
      // 울산
      [/울산/,                '울산'],
      // 제주
      [/제주시/,              '제주시'],
      [/서귀포/,              '서귀포'],
      [/제주(?!시)/,          '제주'],
      // 강원
      [/강릉/,                '강릉'],
      [/속초/,                '속초'],
      [/춘천/,                '춘천'],
      [/평창/,                '평창'],
      // 충청
      [/청주/,                '청주'],
      [/천안/,                '천안'],
      [/공주/,                '공주'],
      // 전라
      [/전주/,                '전주'],
      [/여수/,                '여수'],
      [/순천/,                '순천'],
      // 경상
      [/경주/,                '경주'],
      [/포항/,                '포항'],
      [/창원/,                '창원'],
      [/통영/,                '통영'],
      [/거제/,                '거제'],
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
- 지역 정보가 전혀 없으면 커플의 취향에 맞는 적절한 국내 지역을 자유롭게 선택하세요 (서울 외 지방도 가능)
- 지역명은 카카오 장소 검색에서 인식 가능한 구체적인 지명으로 작성하세요
- 컨텍스트의 예정된 플랜에 이미 있는 장소 유형은 중복 추천하지 마세요 (다양성 확보)

다음 JSON만 반환 (다른 텍스트·마크다운 없이):
{
  "region": "구체적인 지역명 (예: 홍대, 강남, 해운대, 전주 한옥마을, 제주 애월, 강릉, 여수)",
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
      // 마크다운 코드블록 제거 후 파싱
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed = JSON.parse(jsonMatch[0]);
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
    return { region: forcedRegion ?? '강남', keywords: ['브런치 카페', '레스토랑', '전시', '공원', '루프탑 바'] };
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

  // ── 16. AI 데이트 분석 (15크레딧, 파트너 구독 시 50% 할인) ──────────────────────
  async aiDateAnalysis(userId: string, userNote?: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const partnerId = couple.user1Id === userId ? couple.user2Id : couple.user1Id;

    // 파트너가 구독자이면 비구독인 본인은 50% 할인
    const partnerSubscribed = await this.creditService.isSubscribed(partnerId);
    const discountRate = partnerSubscribed ? 0.5 : 0;
    const creditsRemaining = await this.creditService.spend(userId, COUPLE_DATE_AI_COST, 'COUPLE_DATE_AI' as any, couple.id, discountRate);

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

    const isUser1 = couple.user1Id === userId;
    const me = isUser1 ? couple.user1 : couple.user2;
    const partner = isUser1 ? couple.user2 : couple.user1;

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

    const myVibesText = me.preferredVibes?.length ? me.preferredVibes.join(', ') : '정보 없음';
    const partnerVibesText = partner.preferredVibes?.length ? partner.preferredVibes.join(', ') : '정보 없음';

    const context = `내 취향 바이브: ${myVibesText}\n파트너 취향 바이브: ${partnerVibesText}\n완료된 데이트: ${plansText}\n예정된 플랜: ${plannedPlansText}\n내 북마크: ${myBookmarkText}\n파트너 북마크: ${partnerBookmarkText}`;

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

[커플 취향]
- 내 바이브: ${myVibesText}
- 파트너 바이브: ${partnerVibesText}

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
- 커플의 취향 바이브·북마크·데이트 기록을 분석해 개성 있는 코스를 구성하세요
- 타임라인 5개 항목 중 최소 4개는 위 실제 장소 후보에서 선택하세요
- place 필드에 실제 장소명을 그대로, address 필드에 실제 주소, kakaoId에 [ ] 안의 ID를 넣으세요
- 실제 장소가 부족한 경우에만 place에 장소 유형을 쓰고 address·kakaoId는 null로 하세요
- 동선이 자연스럽도록 가까운 장소끼리 묶어 배치하세요 (오전→점심→오후→저녁→야간)
- tip은 그 장소에서 커플이 실제로 할 수 있는 구체적인 행동 팁을 적어주세요 (예: "웨이팅 많으니 11시 오픈런 추천", "루프탑 야외석 예약 필수")

다음 JSON 형식으로만 응답하세요 (추가 텍스트 없이):
{
  "analysis": "커플의 취향 바이브·북마크를 기반으로 이 코스를 추천하는 이유를 구체적으로 (2-3문장, 한국어). 데이터가 없으면 지역과 계절 분위기 기반으로 설명하세요.",
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

  // ── 16-2. AI 타임라인 수정 (2크레딧, 파트너 구독 시 50% 할인) ────────────────────
  async aiRefineTimeline(userId: string, timeline: any[], feedback: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    const partnerId = couple.user1Id === userId ? couple.user2Id : couple.user1Id;
    const partnerSubscribed = await this.creditService.isSubscribed(partnerId);
    const discountRate = partnerSubscribed ? 0.5 : 0;
    const creditsRemaining = await this.creditService.spend(userId, COUPLE_DATE_AI_REFINE_COST, 'COUPLE_DATE_AI' as any, couple.id, discountRate);

    // 기존 타임라인에서 지역 추출 (주소 있는 항목 우선, 시·구·동 단위로 안정적 파싱)
    const regionFromTimeline = (() => {
      for (const t of timeline) {
        if (!t.address) continue;
        const parts = t.address.split(' ');
        // "서울 강남구 청담동..." → "강남구" 또는 "강남구 청담동"
        const siIdx = parts.findIndex((p: string) => p.endsWith('시') || p.endsWith('도'));
        if (siIdx >= 0 && parts[siIdx + 1]) return parts[siIdx + 1];
        // 도시명 없이 "강남구 청담동..." 형태
        if (parts[0]) return parts[0];
      }
      return '해당 지역';
    })();

    // 피드백 + 지역 조합으로 카카오 검색 (피드백 자체가 장소 유형이면 더 정확)
    const searchKeyword = feedback.length <= 20 ? feedback : feedback.slice(0, 20);
    const placeCandidates = await this.searchKakaoForDate(regionFromTimeline, [searchKeyword], 5);

    const placesListText = placeCandidates.length === 0
      ? '검색된 대안 장소가 없습니다.'
      : placeCandidates.map((p, i) => `${i + 1}. [${p.id}] ${p.name} | ${p.address} | ${p.category}`).join('\n');

    const timelineText = timeline.map(t =>
      `${t.time} ${t.emoji} ${t.place}${t.address ? ` (${t.address})` : ''} - ${t.activity}`
    ).join('\n');

    const prompt = `커플의 하루 데이트 타임라인을 수정 요청에 맞게 업데이트해주세요.

[현재 타임라인]
${timelineText}

[수정 요청 — 반드시 반영]
${feedback}

[대안으로 쓸 수 있는 실제 장소 후보 (카카오 검색 결과)]
${placesListText}

[규칙]
- 수정 요청에서 바꾸라는 항목만 수정하고, 나머지 항목은 반드시 원래대로 유지하세요
- 수정 요청이 특정 시간대(점심, 저녁 등)를 언급하면 해당 시간대 항목만 교체하세요
- 변경 항목은 가능하면 실제 장소 후보에서 선택하세요
- 실제 장소를 선택했다면 place에 실제 장소명, address에 실제 주소, kakaoId에 [ ] 안의 ID를 사용하세요
- 실제 장소 후보가 없으면 수정 요청에 맞는 장소 유형을 place에 쓰고 address·kakaoId는 null로 하세요
- 기존 항목의 address·kakaoId는 변경하지 않는 한 그대로 유지하세요

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

    // base64 크기 및 MIME 타입 검증
    if (!data.base64 || typeof data.base64 !== 'string') throw new BadRequestException('이미지 데이터가 없어요.');
    if (data.base64.length > 14 * 1024 * 1024) throw new BadRequestException('이미지 크기는 10MB 이하여야 해요.');
    const allowedPrefixes = ['data:image/jpeg', 'data:image/png', 'data:image/webp', '/9j/', 'iVBORw'];
    if (!allowedPrefixes.some((p) => data.base64.startsWith(p))) throw new BadRequestException('지원하지 않는 이미지 형식이에요.');

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

    // expo-image-picker는 data URI 없이 raw base64 반환 → PNG는 'iVBORw' 로 시작
    const isPng = data.base64.startsWith('iVBORw') || data.base64.startsWith('data:image/png');
    const ext = isPng ? 'png' : 'jpg';

    const base64Data = data.base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = isPng ? 'image/png' : 'image/jpeg';

    // R2에 업로드 (full URL 반환)
    const imageUrl = await this.r2.upload(buffer, 'memories', ext, mimeType);

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

    if (memory.imageUrl) {
      void this.r2.deleteByUrl(memory.imageUrl);
    }

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
  async reportUser(reporterId: string, dto: { reportedId: string; reason: string; detail?: string; imageUrls?: string[] }) {
    if (reporterId === dto.reportedId) throw new BadRequestException('자기 자신을 신고할 수 없어요.');
    const reported = await this.prisma.user.findUnique({ where: { id: dto.reportedId } });
    if (!reported) throw new NotFoundException('사용자를 찾을 수 없어요.');

    // base64 이미지 → R2 업로드 (최대 3개)
    const uploadedUrls: string[] = [];
    if (dto.imageUrls && dto.imageUrls.length > 0) {
      const limited = dto.imageUrls.slice(0, 3);
      for (const b64 of limited) {
        if (!b64 || typeof b64 !== 'string') continue;
        if (b64.length > 14 * 1024 * 1024) throw new BadRequestException('이미지 크기는 10MB 이하여야 해요.');
        const allowedPrefixes = ['data:image/jpeg', 'data:image/png', 'data:image/webp', '/9j/', 'iVBORw'];
        if (!allowedPrefixes.some((p) => b64.startsWith(p))) throw new BadRequestException('지원하지 않는 이미지 형식이에요.');
        const isPng = b64.startsWith('iVBORw') || b64.startsWith('data:image/png');
        const ext = isPng ? 'png' : 'jpg';
        const base64Data = b64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const mimeType = isPng ? 'image/png' : 'image/jpeg';
        const url = await this.r2.upload(buffer, 'reports', ext, mimeType);
        uploadedUrls.push(url);
      }
    }

    return this.prisma.userReport.create({
      data: {
        reporterId,
        reportedId: dto.reportedId,
        reason: dto.reason as any,
        detail: dto.detail,
        imageUrls: uploadedUrls,
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
      const isPng = dto.imageBase64.startsWith('iVBORw') || dto.imageBase64.startsWith('data:image/png');
      const ext = isPng ? 'png' : 'jpg';
      const mimeType = isPng ? 'image/png' : 'image/jpeg';
      const base64Data = dto.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      imageUrl = await this.r2.upload(buffer, 'chat', ext, mimeType);
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

    // imageUrl은 R2 full URL이므로 그대로 반환
    return message;
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
    imageBase64?: string,
    imageMimeType?: string,
  ) {
    // 프리미엄 체크
    const subscribed = await this.creditService.isSubscribed(userId);
    if (!subscribed) {
      throw new ForbiddenException('AI 데이트 비서는 프리미엄 기능이에요. 구독 후 이용해주세요!');
    }

    // 커플 체크
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 등록 후 이용할 수 있어요.');

    const isUser1 = couple.user1Id === userId;
    const me = isUser1 ? couple.user1 : couple.user2;
    const partner = isUser1 ? couple.user2 : couple.user1;

    // 커플 컨텍스트 구성 (최근 데이트 + 북마크)
    const [recentPlans, myBookmarks, partnerBookmarks] = await Promise.all([
      this.prisma.datePlan.findMany({
        where: { coupleId: couple.id },
        orderBy: { dateAt: 'desc' },
        take: 5,
        select: { title: true, dateAt: true, status: true },
      }),
      this.prisma.bookmark.findMany({
        where: { userId },
        include: { place: { select: { name: true, category: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.bookmark.findMany({
        where: { userId: partner.id },
        include: { place: { select: { name: true, category: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const myVibes = me.preferredVibes?.join(', ') || '정보 없음';
    const partnerVibes = partner.preferredVibes?.join(', ') || '정보 없음';
    const plansText = recentPlans.length === 0
      ? '아직 없음'
      : recentPlans.map(p => `${p.title} (${new Date(p.dateAt).toLocaleDateString('ko-KR')}, ${p.status === 'COMPLETED' ? '완료' : '예정'})`).join(', ');
    const myBmText = myBookmarks.length === 0 ? '없음' : myBookmarks.map(b => b.place.name).join(', ');
    const partnerBmText = partnerBookmarks.length === 0 ? '없음' : partnerBookmarks.map(b => b.place.name).join(', ');
    const locationHint = lat != null && lng != null ? '현재 위치 정보 있음 (주변 장소 검색 가능)' : '위치 정보 없음';

    const systemPrompt = `당신은 커플 전용 AI 데이트 비서입니다. 아래 커플 정보를 바탕으로 맞춤 데이트 조언을 해주세요.

[커플 정보]
- 나: ${me.nickname ?? me.name} / 취향 바이브: ${myVibes}
- 파트너: ${partner.nickname ?? partner.name} / 취향 바이브: ${partnerVibes}
- 최근 데이트: ${plansText}
- 내 북마크 장소: ${myBmText}
- 파트너 북마크 장소: ${partnerBmText}
- ${locationHint}

[응답 규칙]
- 한국어로 친근하고 따뜻하게 대화하세요
- 커플의 취향·북마크·데이트 기록을 적극 반영해 맞춤 제안을 하세요
- 장소 추천 시 구체적인 장소 유형이나 카테고리 키워드를 명시하세요 (예: "홍대 루프탑 바", "강남 브런치 카페")
- 코스나 일정 제안 시 오전→점심→오후→저녁 흐름으로 동선을 자연스럽게 구성하세요
- 이미지가 첨부되면 사진 분위기를 분석해 어울리는 데이트 코스를 제안하세요
- 응답은 500자 이내로 핵심만 담아 전달하세요`;

    // Gemini contents 형식으로 변환
    const msgContents = messages.map((m, idx) => {
      // 마지막 사용자 메시지에 이미지 첨부
      if (idx === messages.length - 1 && m.role === 'user' && imageBase64 && imageMimeType) {
        return {
          role: m.role,
          parts: [
            { inline_data: { mime_type: imageMimeType, data: imageBase64 } },
            { text: m.text || '이 이미지를 분석해서 데이트 코스를 추천해줘' },
          ],
        };
      }
      return { role: m.role, parts: [{ text: m.text }] };
    });

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: '안녕하세요! 두 분의 데이트를 도와드릴게요 💕 어떤 데이트를 원하세요?' }] },
      ...msgContents,
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
            generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
          }),
        },
      );
      const data = await res.json() as any;
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? responseText;

      // 장소 추천 의도 감지 → 카카오 검색
      if (lat != null && lng != null) {
        const placeKeyword = this.extractPlaceKeyword(responseText);
        if (placeKeyword) {
          try {
            places = await this.kakao.searchByKeyword(placeKeyword, lat, lng, 1, 'distance', 3);
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

  // ── 내부 헬퍼: AI 응답에서 장소 검색 키워드 추출 ──────────────────────────────
  private extractPlaceKeyword(text: string): string | null {
    const PLACE_TRIGGERS = ['추천', '가볼만한', '어때요', '어때', '좋겠어요', '방문', '들러', '가보세요', '가시면', '가봐요'];
    const hasTrigger = PLACE_TRIGGERS.some(t => text.includes(t));
    if (!hasTrigger) return null;

    // 따옴표 안 키워드 우선
    const quotedMatch = text.match(/["「『]([^"」』]{2,15})["」』]/);
    if (quotedMatch) return quotedMatch[1];

    // 지역명 + 장소 유형 패턴 (예: "홍대 카페", "강남 루프탑 바")
    const regionCategoryMatch = text.match(/([가-힣]{2,5}[동구역시]?\s+)([가-힣a-zA-Z\s]{2,10}(?:카페|레스토랑|맛집|공원|전시|미술관|영화관|이자카야|루프탑|베이커리|바|펍))/);
    if (regionCategoryMatch) return regionCategoryMatch[0].trim();

    // 장소 카테고리 단독 키워드
    const PLACE_CATEGORIES = [
      '루프탑 바', '브런치 카페', '이탈리안 레스토랑', '미술관', '전시관',
      '한강공원', '감성 카페', '이자카야', '야경 맛집', '테라스 카페',
      '카페', '레스토랑', '맛집', '공원', '전시', '영화관', '노래방', '볼링장',
    ];
    for (const cat of PLACE_CATEGORIES) {
      if (text.includes(cat)) return cat;
    }

    return null;
  }

  private async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
    if (!user?.isAdmin) throw new ForbiddenException('관리자 권한이 필요해요.');
  }
}

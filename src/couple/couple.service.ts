import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';

const COUPLE_DATE_AI_COST = 15;

@Injectable()
export class CoupleService {
  constructor(
    private prisma: PrismaService,
    private creditService: CreditService,
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

  // ── 16. AI 데이트 분석 (15크레딧) ────────────────────────────────────────────
  async aiDateAnalysis(userId: string) {
    const couple = await this.findMyCouple(userId);
    if (!couple) throw new NotFoundException('커플 정보를 찾을 수 없어요.');

    await this.creditService.spend(userId, COUPLE_DATE_AI_COST, 'COUPLE_DATE_AI' as any, couple.id);

    const completedPlans = await this.prisma.datePlan.findMany({
      where: { coupleId: couple.id, status: 'COMPLETED' },
      orderBy: { dateAt: 'desc' },
      take: 10,
    });

    const plansText = completedPlans.length === 0
      ? '아직 완료된 데이트 기록이 없습니다.'
      : completedPlans.map(p => `- ${p.title} (${new Date(p.dateAt).toLocaleDateString('ko-KR')})`).join('\n');

    const prompt = `당신은 커플의 데이트 코디네이터입니다.
아래는 이 커플의 최근 데이트 기록입니다:
${plansText}

다음 JSON 형식으로만 응답하세요 (추가 텍스트 없이):
{
  "analysis": "데이트 패턴 분석 요약 (2-3문장, 한국어)",
  "recommendations": [
    { "type": "장소 유형", "activity": "추천 활동", "reason": "추천 이유" },
    { "type": "장소 유형", "activity": "추천 활동", "reason": "추천 이유" },
    { "type": "장소 유형", "activity": "추천 활동", "reason": "추천 이유" }
  ]
}`;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        },
      );
      const raw = await response.json();
      const text = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { analysis: text, recommendations: [] };
    } catch {
      return {
        analysis: '데이트 기록이 쌓일수록 더 정확한 분석이 가능해요. 멋진 데이트를 기록해보세요!',
        recommendations: [
          { type: '카페', activity: '브런치 데이트', reason: '가볍게 이야기 나누기 좋아요' },
          { type: '공원', activity: '산책 & 피크닉', reason: '자연 속에서 여유로운 시간을 보내보세요' },
          { type: '문화공간', activity: '전시회 관람', reason: '새로운 경험을 함께 나눠보세요' },
        ],
      };
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

  private async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
    if (!user?.isAdmin) throw new ForbiddenException('관리자 권한이 필요해요.');
  }
}

import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreditTxType } from '@prisma/client';

// 다른 모듈에서 @prisma/client 직접 참조 대신 여기서 re-export
export { CreditTxType };

export const CREDIT_COSTS = {
  MOOD_SEARCH_BASIC: 5,
  MOOD_SEARCH_AI: 10,
} as const;

export const CREDIT_REWARDS = {
  SIGNUP_BONUS: 100,
  CHECKIN_GPS: 15,
  CHECKIN_RECEIPT: 20,
  AD_WATCH: 15,
} as const;

export const AD_DAILY_LIMIT = 5;

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private prisma: PrismaService) {}

  // ── 잔액 조회 ──────────────────────────────────────────────────────────────
  async getBalance(userId: string): Promise<{ credits: number; isPremium: boolean }> {
    const [user, activeSub] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }),
      this.prisma.subscription.findFirst({
        where: { userId, expiresAt: { gt: new Date() } },
      }),
    ]);
    return { credits: user?.credits ?? 0, isPremium: !!activeSub };
  }

  // ── 구독 여부 확인 ─────────────────────────────────────────────────────────
  async isSubscribed(userId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
    });
    return !!sub;
  }

  // ── 크레딧 소모 (구독자는 차감 없이 통과) ─────────────────────────────────
  async spend(
    userId: string,
    amount: number,
    type: CreditTxType,
    referenceId?: string,
  ): Promise<number> {
    const subscribed = await this.isSubscribed(userId);
    if (subscribed) return (await this.getBalance(userId)).credits; // 구독자는 그냥 통과

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없어요.');
    if (user.credits < amount) {
      throw new BadRequestException(
        `크레딧이 부족해요. 필요: ${amount}, 보유: ${user.credits}`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { credits: { decrement: amount } },
        select: { credits: true },
      }),
      this.prisma.creditTransaction.create({
        data: { userId, amount: -amount, type, referenceId },
      }),
    ]);

    this.logger.log(`크레딧 소모 [${type}] userId=${userId} -${amount} → ${updated.credits}`);
    return updated.credits;
  }

  // ── 크레딧 획득 ────────────────────────────────────────────────────────────
  async earn(
    userId: string,
    amount: number,
    type: CreditTxType,
    referenceId?: string,
  ): Promise<number> {
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
        select: { credits: true },
      }),
      this.prisma.creditTransaction.create({
        data: { userId, amount: +amount, type, referenceId },
      }),
    ]);

    this.logger.log(`크레딧 획득 [${type}] userId=${userId} +${amount} → ${updated.credits}`);
    return updated.credits;
  }

  // ── 광고 시청 보상 (하루 5회 제한) ────────────────────────────────────────
  async watchAd(userId: string): Promise<{ credits: number; earned: number; adWatchesToday: number }> {
    const today = this.todayKst();

    const watchCount = await this.prisma.adWatchLog.count({
      where: { userId, date: today },
    });

    if (watchCount >= AD_DAILY_LIMIT) {
      throw new BadRequestException(
        `오늘은 더 이상 광고를 시청할 수 없어요. 내일 다시 시도해주세요. (${AD_DAILY_LIMIT}회/일 제한)`,
      );
    }

    const earned = CREDIT_REWARDS.AD_WATCH;

    await this.prisma.adWatchLog.create({ data: { userId, date: today } });
    const credits = await this.earn(userId, earned, CreditTxType.AD_WATCH);

    return { credits, earned, adWatchesToday: watchCount + 1 };
  }

  // ── 오늘 광고 시청 횟수 ────────────────────────────────────────────────────
  async getAdWatchesToday(userId: string): Promise<number> {
    const today = this.todayKst();
    return this.prisma.adWatchLog.count({ where: { userId, date: today } });
  }

  // ── 크레딧 내역 조회 ───────────────────────────────────────────────────────
  async getHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.creditTransaction.count({ where: { userId } }),
    ]);
    return { items, total, page, hasNext: skip + items.length < total };
  }

  // ── 어드민: 유저 크레딧 목록 ──────────────────────────────────────────────
  async adminGetUsersWithCredits(adminId: string) {
    await this.assertAdmin(adminId);
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        credits: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── 어드민: 유저 크레딧 지급/차감 ─────────────────────────────────────────
  async adminAdjustCredits(
    adminId: string,
    userId: string,
    amount: number, // 양수=지급, 음수=차감
  ): Promise<{ credits: number }> {
    await this.assertAdmin(adminId);

    if (amount === 0) throw new BadRequestException('변경량이 0입니다.');

    if (amount > 0) {
      const credits = await this.earn(userId, amount, CreditTxType.ADMIN_GRANT, adminId);
      return { credits };
    } else {
      // 음수: 강제 차감 (잔액 부족해도 0으로 클램프)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });
      const deduct = Math.min(Math.abs(amount), user?.credits ?? 0);
      if (deduct === 0) return { credits: user?.credits ?? 0 };

      const [updated] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { credits: { decrement: deduct } },
          select: { credits: true },
        }),
        this.prisma.creditTransaction.create({
          data: { userId, amount: -deduct, type: CreditTxType.ADMIN_GRANT, referenceId: adminId },
        }),
      ]);
      return { credits: updated.credits };
    }
  }

  // ── 어드민 확인 ────────────────────────────────────────────────────────────
  private async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) throw new ForbiddenException('관리자만 접근할 수 있어요.');
  }

  // ── 신규 가입 보너스 ───────────────────────────────────────────────────────
  async grantSignupBonus(userId: string): Promise<void> {
    // DB 기본값으로 이미 100 설정됨, 트랜잭션 로그만 남김
    await this.prisma.creditTransaction.create({
      data: {
        userId,
        amount: CREDIT_REWARDS.SIGNUP_BONUS,
        type: CreditTxType.SIGNUP_BONUS,
      },
    });
  }

  // ── KST 오늘 날짜 (YYYY-MM-DD) ────────────────────────────────────────────
  private todayKst(): string {
    const now = new Date();
    // KST = UTC+9
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  }
}

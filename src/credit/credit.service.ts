import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  CreditTxType,
  SubscriptionPlatform,
  SubscriptionType,
} from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';

// ── Apple 영수증 응답 타입 ─────────────────────────────────────────────────────
interface AppleReceiptInfo {
  product_id: string;
  expires_date_ms: string;
  [key: string]: unknown;
}
interface AppleVerifyResponse {
  status: number;
  latest_receipt_info?: AppleReceiptInfo[];
}

// ── Google Play 구독 응답 타입 ─────────────────────────────────────────────────
interface GoogleSubscriptionPurchase {
  paymentState: number;
  expiryTimeMillis: string;
  [key: string]: unknown;
}

// ── Google OAuth2 토큰 응답 타입 ───────────────────────────────────────────────
interface GoogleTokenResponse {
  access_token: string;
  [key: string]: unknown;
}

// 다른 모듈에서 @prisma/client 직접 참조 대신 여기서 re-export
export { CreditTxType, SubscriptionType, SubscriptionPlatform };

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

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  // ── 잔액 조회 ──────────────────────────────────────────────────────────────
  async getBalance(
    userId: string,
  ): Promise<{ credits: number; isPremium: boolean }> {
    const [user, activeSub] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      }),
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

  // ── 사용자 구독 취소 (즉시 만료) ──────────────────────────────────────────
  async cancelSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
    });
    if (!sub) throw new NotFoundException('활성 구독이 없어요.');

    await this.prisma.subscription.updateMany({
      where: { userId, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });

    this.logger.log(`구독 취소 userId=${userId}`);
    return { ok: true, message: '구독이 취소되었어요.' };
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

    this.logger.log(
      `크레딧 소모 [${type}] userId=${userId} -${amount} → ${updated.credits}`,
    );
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

    this.logger.log(
      `크레딧 획득 [${type}] userId=${userId} +${amount} → ${updated.credits}`,
    );
    return updated.credits;
  }

  // ── 광고 시청 보상 (하루 5회 제한) ────────────────────────────────────────
  async watchAd(
    userId: string,
  ): Promise<{ credits: number; earned: number; adWatchesToday: number }> {
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
      const credits = await this.earn(
        userId,
        amount,
        CreditTxType.ADMIN_GRANT,
        adminId,
      );
      // 크레딧 지급 알림
      this.notificationService
        .send(
          userId,
          'CREDIT',
          '크레딧이 지급됐어요 🎁',
          `리워드 크레딧 ${amount}개가 지급되었어요.`,
          { amount, type: 'ADMIN_GRANT' },
        )
        .catch(() => {});
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
          data: {
            userId,
            amount: -deduct,
            type: CreditTxType.ADMIN_GRANT,
            referenceId: adminId,
          },
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
    if (!user?.isAdmin)
      throw new ForbiddenException('관리자만 접근할 수 있어요.');
  }

  // ── 구독 관리 ──────────────────────────────────────────────────────────────

  // 어드민: 구독 목록 (활성 구독 유저)
  async adminListSubscriptions(adminId: string, page = 1, limit = 30) {
    await this.assertAdmin(adminId);
    const skip = (page - 1) * limit;
    const now = new Date();
    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { expiresAt: { gt: now } },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              nickname: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subscription.count({ where: { expiresAt: { gt: now } } }),
    ]);
    return { items, total, page, hasNext: skip + items.length < total };
  }

  // 어드민: 구독 부여
  async adminGrantSubscription(
    adminId: string,
    userId: string,
    type: SubscriptionType,
    durationDays: number,
  ) {
    await this.assertAdmin(adminId);
    // 이메일 형식이면 이메일로 검색, 아니면 UUID로 검색
    const isEmail = userId.includes('@');
    const user = isEmail
      ? await this.prisma.user.findFirst({ where: { email: userId } })
      : await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없어요.');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const sub = await this.prisma.subscription.create({
      data: {
        userId: user.id,
        platform: SubscriptionPlatform.WEB,
        type,
        receiptData: '',
        productId: `admin_grant_${type.toLowerCase()}`,
        expiresAt,
        adminId,
      },
      include: {
        user: { select: { id: true, name: true, nickname: true, email: true } },
      },
    });

    // 프리미엄 전환 알림
    const durationText = this.formatDuration(durationDays);
    this.notificationService
      .send(
        user.id,
        'CREDIT',
        '프리미엄 멤버십이 활성화됐어요 👑',
        `관리자에 의해 프리미엄 계정으로 전환되었습니다!\n${durationText}동안 프리미엄 계정으로 사용하실 수 있습니다`,
        { type: 'PREMIUM_GRANT', durationDays, expiresAt: expiresAt.toISOString() },
      )
      .catch(() => {});

    this.logger.log(
      `구독 부여 [ADMIN] adminId=${adminId} userId=${user.id} type=${type} durationDays=${durationDays}`,
    );
    return sub;
  }

  // 어드민: 전체 크레딧 지급 (이벤트성)
  async adminBulkGrantCredits(
    adminId: string,
    amount: number,
    note?: string,
  ): Promise<{ count: number }> {
    await this.assertAdmin(adminId);
    if (amount <= 0) throw new BadRequestException('지급 크레딧은 1 이상이어야 해요.');

    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });

    const eventNote = note?.trim() || '이벤트 크레딧 지급';

    await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { status: 'ACTIVE', deletedAt: null },
        data: { credits: { increment: amount } },
      }),
      this.prisma.creditTransaction.createMany({
        data: users.map((u) => ({
          userId: u.id,
          amount,
          type: CreditTxType.ADMIN_GRANT,
          referenceId: adminId,
          note: eventNote,
        })),
      }),
    ]);

    // 전체 알림 브로드캐스트
    this.notificationService
      .broadcast(
        adminId,
        `크레딧이 지급됐어요 🎁`,
        `이벤트 보상 크레딧 ${amount}개가 지급되었어요.${note ? ` (${note})` : ''}`,
      )
      .catch(() => {});

    this.logger.log(
      `전체 크레딧 지급 [ADMIN] adminId=${adminId} amount=${amount} count=${users.length} note="${eventNote}"`,
    );
    return { count: users.length };
  }

  // 어드민: 크레딧 지급 내역 (ADMIN_GRANT 트랜잭션)
  async adminGetCreditGrantHistory(adminId: string, page = 1, limit = 30) {
    await this.assertAdmin(adminId);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { type: CreditTxType.ADMIN_GRANT },
        include: {
          user: { select: { id: true, name: true, nickname: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.creditTransaction.count({ where: { type: CreditTxType.ADMIN_GRANT } }),
    ]);

    // referenceId(adminId)로 관리자 정보 조회
    const adminIds = [...new Set(items.map((i) => i.referenceId).filter(Boolean) as string[])];
    const admins = adminIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true, nickname: true, email: true },
        })
      : [];
    const adminMap = new Map(admins.map((a) => [a.id, a]));

    return {
      items: items.map((tx) => ({
        ...tx,
        admin: tx.referenceId ? (adminMap.get(tx.referenceId) ?? null) : null,
      })),
      total,
      page,
      hasNext: skip + items.length < total,
    };
  }

  // 어드민: 전체 구독 내역 (활성 + 만료 포함)
  async adminGetAllSubscriptions(adminId: string, page = 1, limit = 30) {
    await this.assertAdmin(adminId);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        include: {
          user: { select: { id: true, name: true, nickname: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subscription.count(),
    ]);

    // adminId로 관리자 정보 조회
    const adminIds = [...new Set(items.map((s) => s.adminId).filter(Boolean) as string[])];
    const admins = adminIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true, nickname: true, email: true },
        })
      : [];
    const adminMap = new Map(admins.map((a) => [a.id, a]));

    return {
      items: items.map((sub) => ({
        ...sub,
        admin: sub.adminId ? (adminMap.get(sub.adminId) ?? null) : null,
      })),
      total,
      page,
      hasNext: skip + items.length < total,
    };
  }

  // ── 기간 포맷 (30일→1개월, 365일→1년) ─────────────────────────────────────
  private formatDuration(days: number): string {
    if (days >= 365 && days % 365 === 0) return `${days / 365}년`;
    if (days >= 30 && days % 30 === 0) return `${days / 30}개월`;
    if (days >= 365) return `약 ${Math.floor(days / 365)}년`;
    if (days >= 30) return `약 ${Math.round(days / 30)}개월`;
    return `${days}일`;
  }

  // 어드민: 구독 취소 (expiresAt을 현재로 설정)
  async adminRevokeSubscription(adminId: string, userId: string) {
    await this.assertAdmin(adminId);
    const activeSub = await this.prisma.subscription.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
    });
    if (!activeSub) throw new NotFoundException('활성 구독이 없어요.');

    await this.prisma.subscription.update({
      where: { id: activeSub.id },
      data: { expiresAt: new Date() },
    });
    this.logger.log(`구독 취소 [ADMIN] userId=${userId}`);
  }

  // 인앱결제 검증 (Apple/Google 서버 직접 검증)
  async verifyPurchase(
    userId: string,
    platform: SubscriptionPlatform,
    productId: string,
    receiptData: string,
  ) {
    let expiresAt: Date;
    let verifiedProductId = productId;

    if (platform === SubscriptionPlatform.IOS) {
      const result = await this.verifyAppleReceipt(receiptData);
      expiresAt = result.expiresAt;
      verifiedProductId = result.productId;
    } else if (platform === SubscriptionPlatform.ANDROID) {
      const result = await this.verifyGooglePurchase(productId, receiptData);
      expiresAt = result.expiresAt;
    } else {
      throw new BadRequestException('웹 플랫폼은 인앱결제를 지원하지 않아요.');
    }

    const type: SubscriptionType = verifiedProductId.includes('yearly')
      ? SubscriptionType.YEARLY
      : SubscriptionType.MONTHLY;

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        platform,
        type,
        receiptData,
        productId: verifiedProductId,
        expiresAt,
      },
    });
    this.logger.log(
      `구독 검증 완료 [${platform}] userId=${userId} productId=${verifiedProductId} expiresAt=${expiresAt.toISOString()}`,
    );
    return { ...sub, isPremium: true };
  }

  // ── Apple 영수증 검증 ───────────────────────────────────────────────────────
  private async verifyAppleReceipt(
    receiptData: string,
  ): Promise<{ expiresAt: Date; productId: string }> {
    const sharedSecret = process.env.APPLE_SHARED_SECRET;
    if (!sharedSecret)
      throw new BadRequestException('Apple 구독 설정이 올바르지 않아요.');

    const payload = {
      'receipt-data': receiptData,
      password: sharedSecret,
      'exclude-old-transactions': true,
    };

    // 프로덕션 먼저 시도, 21007(샌드박스 영수증)이면 샌드박스로 재시도
    let resp = await axios.post<AppleVerifyResponse>(
      'https://buy.itunes.apple.com/verifyReceipt',
      payload,
      { timeout: 10000 },
    );
    if (resp.data.status === 21007) {
      resp = await axios.post<AppleVerifyResponse>(
        'https://sandbox.itunes.apple.com/verifyReceipt',
        payload,
        { timeout: 10000 },
      );
    }

    if (resp.data.status !== 0) {
      throw new BadRequestException(
        `Apple 영수증 검증 실패 (status: ${resp.data.status})`,
      );
    }

    const latestInfos: AppleReceiptInfo[] = resp.data.latest_receipt_info ?? [];
    if (!latestInfos.length) {
      throw new BadRequestException('유효한 구독 정보를 찾을 수 없어요.');
    }

    // 만료일 기준 최신 레코드
    const latest = latestInfos.sort(
      (a, b) => Number(b.expires_date_ms) - Number(a.expires_date_ms),
    )[0];

    const expiresAt = new Date(Number(latest.expires_date_ms));
    if (expiresAt <= new Date()) {
      throw new BadRequestException('이미 만료된 구독 영수증이에요.');
    }

    return { expiresAt, productId: latest.product_id };
  }

  // ── Google Play 구매 토큰 검증 ─────────────────────────────────────────────
  private async verifyGooglePurchase(
    productId: string,
    purchaseToken: string,
  ): Promise<{ expiresAt: Date }> {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
    if (!serviceAccountJson || !packageName) {
      throw new BadRequestException('Google Play 구독 설정이 올바르지 않아요.');
    }

    const serviceAccount = JSON.parse(serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };
    const accessToken = await this.getGoogleAccessToken(serviceAccount);

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    const { data } = await axios.get<GoogleSubscriptionPurchase>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });

    // paymentState: 0=미결, 1=결제완료, 2=무료체험, 3=지연
    if (data.paymentState !== 1 && data.paymentState !== 2) {
      throw new BadRequestException('유효한 구독 결제 상태가 아니에요.');
    }

    const expiresAt = new Date(Number(data.expiryTimeMillis));
    if (expiresAt <= new Date()) {
      throw new BadRequestException('이미 만료된 구독이에요.');
    }

    return { expiresAt };
  }

  // ── Google 서비스 계정 → OAuth2 액세스 토큰 ────────────────────────────────
  private async getGoogleAccessToken(serviceAccount: {
    client_email: string;
    private_key: string;
  }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    ).toString('base64url');
    const jwtPayload = Buffer.from(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ).toString('base64url');

    const signingInput = `${header}.${jwtPayload}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = sign.sign(serviceAccount.private_key, 'base64url');
    const jwt = `${signingInput}.${signature}`;

    const { data } = await axios.post<GoogleTokenResponse>(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
      { timeout: 10000 },
    );

    return data.access_token;
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

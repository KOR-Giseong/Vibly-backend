import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, Prisma } from '@prisma/client';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  // ── 토큰 등록/갱신 ─────────────────────────────────────────────────────────
  async registerToken(
    userId: string,
    pushToken: string,
    platform: string,
  ): Promise<void> {
    if (!Expo.isExpoPushToken(pushToken)) {
      this.logger.warn(`Invalid Expo push token for user=${userId}`);
      return;
    }
    await this.prisma.device.upsert({
      where: { pushToken },
      create: { userId, pushToken, platform },
      update: { userId, platform },
    });
  }

  // ── 토큰 제거 (로그아웃 시) ─────────────────────────────────────────────────
  async removeToken(userId: string, pushToken?: string): Promise<void> {
    if (pushToken) {
      await this.prisma.device
        .deleteMany({ where: { userId, pushToken } })
        .catch(() => {});
    } else {
      await this.prisma.device
        .deleteMany({ where: { userId } })
        .catch(() => {});
    }
  }

  // ── 알림 생성 + 푸시 발송 ──────────────────────────────────────────────────
  async send(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const notifData: Prisma.NotificationCreateInput = {
      user: { connect: { id: userId } },
      type,
      title,
      body,
      payload: (payload ?? {}) as Prisma.InputJsonValue,
    };

    // 1. DB 알림 레코드 생성
    await this.prisma.notification
      .create({ data: notifData })
      .catch((e: unknown) =>
        this.logger.error(`notification insert failed: ${String(e)}`),
      );

    // 2. 해당 유저의 Expo 디바이스 토큰 조회
    const devices = await this.prisma.device
      .findMany({ where: { userId }, select: { pushToken: true } })
      .catch(() => [] as { pushToken: string }[]);

    if (!devices.length) return;

    // 3. Expo 푸시 발송 (fire-and-forget)
    const messages: ExpoPushMessage[] = devices
      .filter((d) => Expo.isExpoPushToken(d.pushToken))
      .map((d) => ({
        to: d.pushToken,
        sound: 'default' as const,
        title,
        body,
        data: (payload ?? {}) as Record<string, string>,
        badge: 1,
        channelId: 'default',
      }));

    if (!messages.length) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      expo
        .sendPushNotificationsAsync(chunk)
        .catch((e: unknown) =>
          this.logger.error(`Expo push send failed: ${String(e)}`),
        );
    }
  }

  // ── 알림 목록 (페이지네이션) ────────────────────────────────────────────────
  async getList(userId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return {
      items,
      total,
      unreadCount,
      page,
      hasNext: skip + items.length < total,
    };
  }

  // ── 읽지 않은 수 ───────────────────────────────────────────────────────────
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  // ── 단건 읽음 처리 ─────────────────────────────────────────────────────────
  async markRead(id: string, userId: string): Promise<void> {
    await this.prisma.notification
      .updateMany({ where: { id, userId }, data: { isRead: true } })
      .catch(() => {});
  }

  // ── 전체 읽음 처리 ─────────────────────────────────────────────────────────
  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification
      .updateMany({ where: { userId, isRead: false }, data: { isRead: true } })
      .catch(() => {});
  }

  // ── 단건 삭제 ──────────────────────────────────────────────────────────────
  async deleteOne(id: string, userId: string): Promise<void> {
    await this.prisma.notification
      .deleteMany({ where: { id, userId } })
      .catch(() => {});
  }

  // ── 전체 사용자 브로드캐스트 (관리자 전용) ────────────────────────────────
  async broadcastByAdmin(
    title: string,
    body: string,
    type: NotificationType = 'PROMO',
  ): Promise<{ sent: number; pushed: number }> {
    return this.broadcast('', title, body, type);
  }

  async broadcast(
    adminId: string,
    title: string,
    body: string,
    type: NotificationType = 'PROMO',
  ): Promise<{ sent: number; pushed: number }> {
    // adminId가 있을 때만 관리자 확인 (내부 호출 시 스킵)
    if (adminId) {
      const admin = await this.prisma.user.findUnique({
        where: { id: adminId },
        select: { isAdmin: true },
      });
      if (!admin?.isAdmin) throw new Error('관리자만 전송할 수 있어요.');
    }

    // 모든 활성 사용자 조회
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    this.logger.log(`broadcast: 대상 유저 ${users.length}명`);

    // DB 알림 일괄 생성
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type,
        title,
        body,
        payload: {},
      })),
      skipDuplicates: true,
    });

    // 활성 유저의 푸시 토큰만 수집
    const activeUserIds = users.map((u) => u.id);
    const devices = await this.prisma.device.findMany({
      where: { userId: { in: activeUserIds } },
      select: { pushToken: true },
    });
    this.logger.log(`broadcast: Device 토큰 ${devices.length}개 조회됨`);

    const messages: import('expo-server-sdk').ExpoPushMessage[] = devices
      .filter((d) => Expo.isExpoPushToken(d.pushToken))
      .map((d) => ({
        to: d.pushToken,
        sound: 'default' as const,
        title,
        body,
        data: {},
        badge: 1,
        channelId: 'default',
      }));

    this.logger.log(`broadcast: 유효한 Expo 토큰 ${messages.length}개 → push 발송 시작`);

    let pushed = 0;
    if (messages.length) {
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          const receipts = await expo.sendPushNotificationsAsync(chunk);
          const errors = receipts.filter((r) => r.status === 'error');
          pushed += receipts.length - errors.length;
          if (errors.length) {
            errors.forEach((e) =>
              this.logger.warn(`push error: ${e.message} (details: ${JSON.stringify(e.details)})`),
            );
          }
        } catch (e: unknown) {
          this.logger.error(`broadcast push failed: ${String(e)}`);
        }
      }
      this.logger.log(`broadcast 완료: 성공 ${pushed}/${messages.length}개`);
    } else {
      this.logger.warn('broadcast: 발송할 유효한 토큰이 없음 → Device 테이블을 확인하세요');
    }

    return { sent: users.length, pushed };
  }
}

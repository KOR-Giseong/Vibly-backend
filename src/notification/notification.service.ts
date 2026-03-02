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
  async broadcast(
    adminId: string,
    title: string,
    body: string,
  ): Promise<{ sent: number }> {
    // 관리자 확인
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { isAdmin: true },
    });
    if (!admin?.isAdmin) throw new Error('관리자만 전송할 수 있어요.');

    // 모든 사용자에게 DB 알림 생성 + 푸시 토큰 수집
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });

    // DB 알림 일괄 생성
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: 'PROMO' as const,
        title,
        body,
        payload: {},
      })),
      skipDuplicates: true,
    });

    // 푸시 토큰 수집 후 발송
    const devices = await this.prisma.device.findMany({
      select: { pushToken: true },
    });

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

    if (messages.length) {
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        expo
          .sendPushNotificationsAsync(chunk)
          .catch((e: unknown) =>
            this.logger.error(`broadcast push failed: ${String(e)}`),
          );
      }
    }

    return { sent: users.length };
  }
}

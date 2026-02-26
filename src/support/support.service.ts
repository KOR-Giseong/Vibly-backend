import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FAQ_CATEGORIES = [
  {
    category: '앱 사용법',
    questions: ['체크인은 어떻게 하나요?', '바이브 리포트는 어떻게 확인하나요?', '장소 검색이 안 돼요', '북마크 기능은 어디에 있나요?'],
  },
  {
    category: '계정',
    questions: ['비밀번호를 잊어버렸어요', '닉네임을 변경하고 싶어요', '계정 탈퇴는 어떻게 하나요?', '소셜 로그인 연동을 해제하고 싶어요'],
  },
  {
    category: '결제/구독',
    questions: ['구독 취소는 어떻게 하나요?', '결제가 중복으로 됐어요', '구독 혜택이 적용 안 돼요', '환불 요청하고 싶어요'],
  },
  {
    category: '오류/버그',
    questions: ['앱이 자꾸 꺼져요', '지도가 표시되지 않아요', '알림이 오지 않아요', '사진 업로드가 안 돼요'],
  },
];

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  getFaqCategories() {
    return FAQ_CATEGORIES;
  }

  async createTicket(userId: string, title: string, body: string, type: 'FAQ' | 'CHAT' = 'CHAT') {
    const ticket = await this.prisma.supportTicket.create({
      data: { userId, title, body, type },
      select: { id: true, type: true, title: true, body: true, status: true, createdAt: true },
    });
    if (type === 'CHAT') {
      await this.prisma.chatMessage.create({
        data: { ticketId: ticket.id, senderId: userId, isAdmin: false, body },
      });
    }
    return ticket;
  }

  async getMyTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        status: true,
        adminReply: true,
        repliedAt: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true, isAdmin: true, createdAt: true },
        },
      },
    });
  }

  async getMessages(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket || ticket.userId !== userId) throw new ForbiddenException('접근할 수 없어요.');
    await this.prisma.chatMessage.updateMany({
      where: { ticketId, isAdmin: true, readAt: null },
      data: { readAt: new Date() },
    });
    return this.prisma.chatMessage.findMany({ where: { ticketId }, orderBy: { createdAt: 'asc' } });
  }

  async sendMessage(userId: string, ticketId: string, body: string, imageUrl?: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket || ticket.userId !== userId) throw new ForbiddenException('접근할 수 없어요.');
    if (ticket.status === 'CLOSED') throw new ForbiddenException('종료된 채팅이에요.');
    const msg = await this.prisma.chatMessage.create({
      data: { ticketId, senderId: userId, isAdmin: false, body, imageUrl },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });
    return msg;
  }

  // ── Admin only ──────────────────────────────────────────────────────────────

  async getAllTickets(adminId: string) {
    await this.assertAdmin(adminId);
    return this.prisma.supportTicket.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            nickname: true,
            avatarUrl: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true, isAdmin: true, createdAt: true, readAt: true },
        },
      },
    });
  }

  async getTicketMessages(adminId: string, ticketId: string) {
    await this.assertAdmin(adminId);
    await this.prisma.chatMessage.updateMany({
      where: { ticketId, isAdmin: false, readAt: null },
      data: { readAt: new Date() },
    });
    return this.prisma.chatMessage.findMany({ where: { ticketId }, orderBy: { createdAt: 'asc' } });
  }

  async adminSendMessage(adminId: string, ticketId: string, body: string, imageUrl?: string) {
    await this.assertAdmin(adminId);
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('문의를 찾을 수 없어요.');
    const msg = await this.prisma.chatMessage.create({
      data: { ticketId, senderId: adminId, isAdmin: true, body, imageUrl },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'IN_PROGRESS', adminReply: body, repliedAt: new Date(), updatedAt: new Date() },
    });
    return msg;
  }

  async replyTicket(adminId: string, ticketId: string, reply: string) {
    await this.assertAdmin(adminId);
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('문의를 찾을 수 없어요.');
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { adminReply: reply, repliedAt: new Date(), status: 'RESOLVED' },
    });
  }

  async updateTicketStatus(adminId: string, ticketId: string, status: string) {
    await this.assertAdmin(adminId);
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' },
    });
  }

  async getUsers(adminId: string) {
    await this.assertAdmin(adminId);
    return this.prisma.user.findMany({
      where: { status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        avatarUrl: true,
        isAdmin: true,
        status: true,
        suspendedUntil: true,
        suspendReason: true,
        isProfileComplete: true,
        provider: true,
        createdAt: true,
        _count: { select: { checkIns: true, reviews: true, bookmarks: true } },
      },
    });
  }

  async suspendUser(adminId: string, targetId: string, reason: string, suspendedUntil: Date) {
    await this.assertAdmin(adminId);
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('사용자를 찾을 수 없어요.');
    if (target.isAdmin) throw new ForbiddenException('관리자는 정지할 수 없어요.');
    return this.prisma.user.update({
      where: { id: targetId },
      data: { status: 'SUSPENDED', suspendReason: reason, suspendedUntil },
      select: { id: true, name: true, status: true, suspendedUntil: true, suspendReason: true },
    });
  }

  async unsuspendUser(adminId: string, targetId: string) {
    await this.assertAdmin(adminId);
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('사용자를 찾을 수 없어요.');
    return this.prisma.user.update({
      where: { id: targetId },
      data: { status: 'ACTIVE', suspendReason: null, suspendedUntil: null },
      select: { id: true, name: true, status: true },
    });
  }

  async toggleAdmin(adminId: string, targetUserId: string) {
    await this.assertAdmin(adminId);
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('사용자를 찾을 수 없어요.');
    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { isAdmin: !target.isAdmin },
      select: { id: true, name: true, isAdmin: true },
    });
  }

  private async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      throw new ForbiddenException('관리자만 접근할 수 있어요.');
    }
  }
}


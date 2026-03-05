import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminMessageService {
  constructor(private prisma: PrismaService) {}

  async getMessages(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminMessage.findMany({
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.adminMessage.count(),
    ]);
    return { items, total, page, hasNext: skip + items.length < total };
  }

  async createMessage(authorId: string, content: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { name: true, nickname: true },
    });
    const authorName = user?.nickname ?? user?.name ?? '관리자';
    return this.prisma.adminMessage.create({
      data: { authorId, authorName, content },
    });
  }

  async deleteMessage(id: string, requesterId: string) {
    const msg = await this.prisma.adminMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('메시지를 찾을 수 없습니다.');
    if (msg.authorId !== requesterId) throw new ForbiddenException('본인 메시지만 삭제할 수 있습니다.');
    return this.prisma.adminMessage.delete({ where: { id } });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminLogOptions {
  targetType?: string;
  targetId?: string;
  detail?: Record<string, any>;
  ip?: string;
}

@Injectable()
export class AdminLogService {
  constructor(private prisma: PrismaService) {}

  async log(adminId: string, action: string, options: AdminLogOptions = {}) {
    try {
      await this.prisma.adminLog.create({
        data: {
          adminId,
          action,
          targetType: options.targetType,
          targetId: options.targetId,
          detail: options.detail ?? undefined,
          ip: options.ip,
        },
      });
    } catch {
      // 로그 실패는 조용히 무시 (비즈니스 로직 영향 없음)
    }
  }

  async getLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.adminLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.adminLog.count(),
    ]);
    return { items, total, page, hasNext: skip + items.length < total };
  }
}

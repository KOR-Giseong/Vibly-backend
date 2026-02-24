import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async trackEvents(userId: string | undefined, events: Array<{ type: EventType; payload?: any }>) {
    return this.prisma.userEvent.createMany({
      data: events.map((e) => ({ userId: userId ?? null, type: e.type, payload: e.payload })),
    });
  }
}

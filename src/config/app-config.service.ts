import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppConfigService {
  constructor(private prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const record = await this.prisma.appConfig.findUnique({ where: { key } });
    return record?.value ?? null;
  }

  async getBoolean(key: string, defaultValue = false): Promise<boolean> {
    const val = await this.get(key);
    if (val === null) return defaultValue;
    return val === 'true';
  }

  async getNumber(key: string, defaultValue = 0): Promise<number> {
    const val = await this.get(key);
    if (val === null) return defaultValue;
    const n = Number(val);
    return isNaN(n) ? defaultValue : n;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.appConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async getAll(): Promise<Record<string, string>> {
    const records = await this.prisma.appConfig.findMany();
    return Object.fromEntries(records.map((r) => [r.key, r.value]));
  }
}

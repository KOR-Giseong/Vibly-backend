import { PrismaService } from '../prisma/prisma.service';
export declare class AppConfigService {
    private prisma;
    constructor(prisma: PrismaService);
    get(key: string): Promise<string | null>;
    getBoolean(key: string, defaultValue?: boolean): Promise<boolean>;
    getNumber(key: string, defaultValue?: number): Promise<number>;
    set(key: string, value: string): Promise<void>;
    getAll(): Promise<Record<string, string>>;
}

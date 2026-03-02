import { ReportReason } from '@prisma/client';
export declare class CreateReportDto {
    reason: ReportReason;
    detail?: string;
}

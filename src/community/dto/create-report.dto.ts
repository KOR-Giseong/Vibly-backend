import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportReason } from '@prisma/client';

export class CreateReportDto {
  @IsEnum(ReportReason)
  reason: ReportReason = ReportReason.OTHER;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  detail?: string;
}

import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportReason } from '@prisma/client';

export class CreateReportDto {
  @IsEnum(ReportReason)
  reason: ReportReason = ReportReason.OTHER;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[]; // base64 strings, up to 3
}

import { IsString, IsOptional, MaxLength, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckInDto {
  @IsString()
  @MaxLength(100, { message: '기분은 100자 이하로 입력해주세요.' })
  mood: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

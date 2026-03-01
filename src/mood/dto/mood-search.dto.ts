import { IsString, IsOptional, IsNumber, Min, Max, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class MoodSearchDto {
  @IsString()
  @MinLength(1, { message: '검색어를 입력해주세요.' })
  @MaxLength(200, { message: '검색어는 200자 이하로 입력해주세요.' })
  query: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(500)
  @Max(20000)
  @Type(() => Number)
  radius?: number;
}

import { IsString, IsOptional, MaxLength, IsUrl } from 'class-validator';

export class CheckInDto {
  @IsString()
  @MaxLength(100, { message: '기분은 100자 이하로 입력해주세요.' })
  mood: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsUrl({}, { message: '올바른 이미지 URL이 아니에요.' })
  imageUrl?: string;
}

import { IsOptional, IsString, MaxLength, IsArray, ArrayMaxSize } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: '닉네임은 30자 이하여야 해요.' })
  nickname?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  preferredVibes?: string[];
}

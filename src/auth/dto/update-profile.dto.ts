import { IsOptional, IsString, MaxLength, IsArray, ArrayMaxSize, IsIn } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '이름은 20자 이하여야 해요.' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: '닉네임은 30자 이하여야 해요.' })
  nickname?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MALE', 'FEMALE', 'OTHER'], { message: '유효하지 않은 성별이에요.' })
  gender?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  preferredVibes?: string[];
}

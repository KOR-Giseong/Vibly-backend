import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: '현재 비밀번호를 입력해주세요.' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: '새 비밀번호는 8자 이상이어야 해요.' })
  @MaxLength(128, { message: '비밀번호는 128자 이하여야 해요.' })
  newPassword: string;
}

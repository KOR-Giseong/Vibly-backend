import { IsEmail, IsString, MinLength } from 'class-validator';

export class EmailLoginDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아니에요.' })
  email: string;

  @IsString()
  @MinLength(1, { message: '비밀번호를 입력해주세요.' })
  password: string;
}

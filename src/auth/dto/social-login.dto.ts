import { IsString, IsOptional } from 'class-validator';

export class SocialLoginDto {
  @IsString()
  idToken: string;

  @IsOptional()
  @IsString()
  redirectUri?: string;
}

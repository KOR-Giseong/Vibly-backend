import { IsEnum, IsString } from 'class-validator';

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

export class RegisterTokenDto {
  @IsString()
  pushToken: string;

  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}

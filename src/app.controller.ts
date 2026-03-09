import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @SkipThrottle({ default: true, auth: true })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @SkipThrottle({ default: true, auth: true })
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}

import { Controller, Post, Patch, Body, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ── Email ──────────────────────────────────────────────────────────────────

  @Post('email/signup')
  emailSignup(@Body() dto: { email: string; password: string; name: string }) {
    return this.authService.emailSignup(dto.email, dto.password, dto.name);
  }

  @Post('email/login')
  emailLogin(@Body() dto: { email: string; password: string }) {
    return this.authService.emailLogin(dto.email, dto.password);
  }

  // ── Social ─────────────────────────────────────────────────────────────────

  @Post('google')
  googleLogin(@Body() dto: { idToken: string; redirectUri: string }) {
    return this.authService.googleLogin(dto.idToken, dto.redirectUri);
  }

  @Post('kakao')
  kakaoLogin(@Body() dto: { idToken: string; redirectUri: string }) {
    return this.authService.kakaoLogin(dto.idToken, dto.redirectUri);
  }

  @Post('apple')
  appleLogin(@Body() dto: { idToken: string }) {
    return this.authService.appleLogin(dto.idToken);
  }

  // ── Token ──────────────────────────────────────────────────────────────────

  @Post('refresh')
  refresh(@Body() dto: { refreshToken: string }) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: any, @Body() dto: { refreshToken: string }) {
    return this.authService.logout(req.user.id, dto.refreshToken);
  }

  // ── Me ─────────────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@Req() req: any) {
    return this.authService.getMe(req.user.id);
  }

  @Get('check-nickname')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  checkNickname(@Req() req: any, @Query('nickname') nickname: string) {
    return this.authService.checkNickname(nickname, req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateProfile(@Req() req: any, @Body() dto: { nickname: string; preferredVibes: string[] }) {
    return this.authService.updateProfile(req.user.id, dto);
  }
}

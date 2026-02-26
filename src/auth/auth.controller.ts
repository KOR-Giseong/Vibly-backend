import { Controller, Post, Patch, Body, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { EmailSignupDto } from './dto/email-signup.dto';
import { EmailLoginDto } from './dto/email-login.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ── Email ──────────────────────────────────────────────────────────────────

  @Post('email/signup')
  @Throttle({ auth: {} })
  emailSignup(@Body() dto: EmailSignupDto) {
    return this.authService.emailSignup(dto.email, dto.password, dto.name);
  }

  @Post('email/login')
  @Throttle({ auth: {} })
  emailLogin(@Body() dto: EmailLoginDto) {
    return this.authService.emailLogin(dto.email, dto.password);
  }

  // ── Social ─────────────────────────────────────────────────────────────────

  @Post('google')
  @Throttle({ auth: {} })
  googleLogin(@Body() dto: SocialLoginDto) {
    return this.authService.googleLogin(dto.idToken, dto.redirectUri ?? '');
  }

  @Post('kakao')
  @Throttle({ auth: {} })
  kakaoLogin(@Body() dto: SocialLoginDto) {
    return this.authService.kakaoLogin(dto.idToken, dto.redirectUri ?? '');
  }

  @Post('apple')
  @Throttle({ auth: {} })
  appleLogin(@Body() dto: SocialLoginDto) {
    return this.authService.appleLogin(dto.idToken);
  }

  // ── Token ──────────────────────────────────────────────────────────────────

  @Post('refresh')
  @Throttle({ auth: {} })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: any, @Body() dto: RefreshTokenDto) {
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
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, {
      name: dto.name,
      nickname: dto.nickname,
      preferredVibes: dto.preferredVibes,
    });
  }

  @Patch('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateAvatar(@Req() req: any, @Body() body: { base64: string }) {
    return this.authService.updateAvatar(req.user.id, body.base64);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getStats(@Req() req: any) {
    return this.authService.getStats(req.user.id);
  }
}

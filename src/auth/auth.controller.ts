import { Controller, Post, Patch, Delete, Body, Get, Query, UseGuards, Req, HttpCode, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { EmailSignupDto } from './dto/email-signup.dto';
import { EmailLoginDto } from './dto/email-login.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

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
    return this.authService.googleLogin(dto.idToken, dto.redirectUri ?? '', dto.codeVerifier);
  }

  @Post('kakao')
  @Throttle({ auth: {} })
  kakaoLogin(@Body() dto: SocialLoginDto) {
    return this.authService.kakaoLogin(dto.idToken);
  }

  @Post('apple')
  @Throttle({ auth: {} })
  appleLogin(@Body() dto: SocialLoginDto) {
    return this.authService.appleLogin(dto.idToken, dto.name);
  }

  // ── Admin Login ────────────────────────────────────────────────────────────

  @Post('admin/login')
  @Throttle({ auth: {} })
  adminEmailLogin(@Body() dto: EmailLoginDto) {
    return this.authService.adminEmailLogin(dto.email, dto.password);
  }

  @Post('admin/google')
  @Throttle({ auth: {} })
  adminGoogleLogin(@Body() dto: SocialLoginDto) {
    return this.authService.adminGoogleLogin(dto.idToken, dto.redirectUri ?? '', dto.codeVerifier);
  }

  @Post('admin/kakao')
  @Throttle({ auth: {} })
  adminKakaoLogin(@Body() dto: SocialLoginDto) {
    return this.authService.adminKakaoLogin(dto.idToken);
  }

  @Post('admin/apple')
  @Throttle({ auth: {} })
  adminAppleLogin(@Body() dto: SocialLoginDto) {
    return this.authService.adminAppleLogin(dto.idToken);
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
    if (!nickname || nickname.trim().length === 0) throw new BadRequestException('닉네임을 입력해주세요.');
    if (nickname.length > 30) throw new BadRequestException('닉네임은 30자 이하여야 해요.');
    return this.authService.checkNickname(nickname.trim(), req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, {
      name: dto.name,
      nickname: dto.nickname,
      gender: dto.gender,
      preferredVibes: dto.preferredVibes,
    });
  }

  @Patch('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateAvatar(@Req() req: any, @Body() body: { base64: string }) {
    if (!body?.base64 || typeof body.base64 !== 'string') throw new BadRequestException('이미지 데이터가 없어요.');
    // base64 문자열 크기 제한: ~10MB 이미지 → base64 약 13.7MB
    if (body.base64.length > 14 * 1024 * 1024) throw new BadRequestException('이미지 크기는 10MB 이하여야 해요.');
    const allowedPrefixes = ['data:image/jpeg', 'data:image/png', 'data:image/webp', '/9j/', 'iVBORw'];
    if (!allowedPrefixes.some((p) => body.base64.startsWith(p))) throw new BadRequestException('지원하지 않는 이미지 형식이에요.');
    return this.authService.updateAvatar(req.user.id, body.base64);
  }

  @Delete('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  resetAvatar(@Req() req: any) {
    return this.authService.resetAvatar(req.user.id);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getStats(@Req() req: any) {
    return this.authService.getStats(req.user.id);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  deleteAccount(@Req() req: any) {
    return this.authService.deleteAccount(req.user.id);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  changePassword(
    @Req() req: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }
}

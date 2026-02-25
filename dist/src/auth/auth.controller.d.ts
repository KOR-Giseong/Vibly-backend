import { AuthService } from './auth.service';
import { EmailSignupDto } from './dto/email-signup.dto';
import { EmailLoginDto } from './dto/email-login.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    emailSignup(dto: EmailSignupDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    emailLogin(dto: EmailLoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    googleLogin(dto: SocialLoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    kakaoLogin(dto: SocialLoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    appleLogin(dto: SocialLoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    refresh(dto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(req: any, dto: RefreshTokenDto): Promise<void>;
    me(req: any): Promise<{
        id: string;
        email: string | null;
        nickname: string | null;
        name: string;
        preferredVibes: string[];
        isProfileComplete: boolean;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
    } | null>;
    checkNickname(req: any, nickname: string): Promise<{
        available: boolean;
    }>;
    updateProfile(req: any, dto: UpdateProfileDto): Promise<{
        id: string;
        email: string | null;
        nickname: string | null;
        name: string;
        preferredVibes: string[];
        isProfileComplete: boolean;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
    }>;
}

import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    emailSignup(dto: {
        email: string;
        password: string;
        name: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    emailLogin(dto: {
        email: string;
        password: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    googleLogin(dto: {
        idToken: string;
        redirectUri: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    kakaoLogin(dto: {
        idToken: string;
        redirectUri: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    appleLogin(dto: {
        idToken: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    refresh(dto: {
        refreshToken: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(req: any, dto: {
        refreshToken: string;
    }): Promise<void>;
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
    updateProfile(req: any, dto: {
        nickname: string;
        preferredVibes: string[];
    }): Promise<{
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

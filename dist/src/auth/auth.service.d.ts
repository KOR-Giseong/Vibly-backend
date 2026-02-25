import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
export declare class AuthService {
    private prisma;
    private jwt;
    private config;
    private http;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, http: HttpService);
    emailSignup(email: string, password: string, name: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    emailLogin(email: string, password: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    googleLogin(code: string, redirectUri: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    kakaoLogin(code: string, redirectUri: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    appleLogin(idToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    private verifyAppleToken;
    private upsertSocialUser;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(userId: string, refreshToken: string): Promise<void>;
    private issueTokens;
    getMe(userId: string): Promise<{
        id: string;
        email: string | null;
        nickname: string | null;
        name: string;
        preferredVibes: string[];
        isProfileComplete: boolean;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
    } | null>;
    checkNickname(nickname: string, userId: string): Promise<{
        available: boolean;
    }>;
    updateProfile(userId: string, data: {
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

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
export declare class AuthService {
    private prisma;
    private jwt;
    private config;
    private http;
    private creditService;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, http: HttpService, creditService: CreditService);
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
    appleLogin(idToken: string, name?: string): Promise<{
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
    deleteAccount(userId: string): Promise<{
        success: boolean;
    }>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
    }>;
    getMe(userId: string): Promise<{
        isPremium: boolean;
        couple: {
            coupleId: string;
            partnerId: string;
            partnerName: string;
            partnerAvatarUrl: string | null;
            creditShareEnabled: boolean;
            anniversaryDate: Date | null;
            createdAt: Date;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        nickname: string | null;
        avatarUrl: string | null;
        gender: string | null;
        preferredVibes: string[];
        isProfileComplete: boolean;
        status: import("@prisma/client").$Enums.UserStatus;
        isAdmin: boolean;
        suspendedUntil: Date | null;
        suspendReason: string | null;
        credits: number;
    } | null>;
    checkNickname(nickname: string, userId: string): Promise<{
        available: boolean;
    }>;
    updateProfile(userId: string, data: {
        name?: string;
        nickname?: string;
        gender?: string;
        preferredVibes?: string[];
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        nickname: string | null;
        avatarUrl: string | null;
        gender: string | null;
        preferredVibes: string[];
        isProfileComplete: boolean;
        status: import("@prisma/client").$Enums.UserStatus;
    }>;
    updateAvatar(userId: string, base64: string): Promise<{
        avatarUrl: string;
    }>;
    resetAvatar(userId: string): Promise<{
        success: boolean;
    }>;
    getStats(userId: string): Promise<{
        checkinCount: number;
        bookmarkCount: number;
        reviewCount: number;
    }>;
}

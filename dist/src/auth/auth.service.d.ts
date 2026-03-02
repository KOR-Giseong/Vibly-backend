import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { R2Service } from '../storage/r2.service';
export declare class AuthService {
    private prisma;
    private jwt;
    private config;
    private http;
    private creditService;
    private r2;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, http: HttpService, creditService: CreditService, r2: R2Service);
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
        email: string | null;
        name: string;
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
        createdAt: Date;
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
        email: string | null;
        name: string;
        nickname: string | null;
        avatarUrl: string | null;
        gender: string | null;
        preferredVibes: string[];
        isProfileComplete: boolean;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
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

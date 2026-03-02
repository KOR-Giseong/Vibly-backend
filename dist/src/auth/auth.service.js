"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const bcrypt = __importStar(require("bcryptjs"));
const crypto = __importStar(require("crypto"));
const jwt = __importStar(require("jsonwebtoken"));
const rxjs_1 = require("rxjs");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const credit_service_1 = require("../credit/credit.service");
const r2_service_1 = require("../storage/r2.service");
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    http;
    creditService;
    r2;
    constructor(prisma, jwt, config, http, creditService, r2) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.http = http;
        this.creditService = creditService;
        this.r2 = r2;
        if (!config.get('JWT_REFRESH_SECRET')) {
            throw new Error('JWT_REFRESH_SECRET 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.');
        }
    }
    async emailSignup(email, password, name) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing)
            throw new common_1.ConflictException('이미 사용 중인 이메일이에요.');
        const deleted = await this.prisma.deletedAccount.findFirst({
            where: { email, canRejoinAt: { gt: new Date() } },
        });
        if (deleted) {
            const days = Math.ceil((deleted.canRejoinAt.getTime() - Date.now()) / 86400000);
            throw new common_1.ConflictException(`탈퇴 후 30일간 재가입이 제한돼요. ${days}일 후에 다시 시도해 주세요.`);
        }
        const hash = await bcrypt.hash(password, 12);
        const user = await this.prisma.user.create({
            data: { email, name, provider: client_1.AuthProvider.EMAIL, passwordHash: hash },
        });
        this.creditService.grantSignupBonus(user.id).catch(() => { });
        return this.issueTokens(user.id);
    }
    async emailLogin(email, password) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash)
            throw new common_1.NotFoundException('등록되지 않은 이메일이에요.');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('비밀번호가 맞지 않아요.');
        return this.issueTokens(user.id);
    }
    async googleLogin(code, redirectUri) {
        try {
            const { data: tokenData } = await (0, rxjs_1.firstValueFrom)(this.http.post('https://oauth2.googleapis.com/token', {
                code,
                client_id: this.config.get('GOOGLE_CLIENT_ID'),
                client_secret: this.config.get('GOOGLE_CLIENT_SECRET'),
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }));
            const payload = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64').toString());
            const { sub, email, name, given_name } = payload;
            return this.upsertSocialUser(client_1.AuthProvider.GOOGLE, sub, email ?? null, name ?? given_name ?? 'Google 사용자');
        }
        catch {
            throw new common_1.BadRequestException('Google 로그인에 실패했어요.');
        }
    }
    async kakaoLogin(code, redirectUri) {
        try {
            const { data: tokenData } = await (0, rxjs_1.firstValueFrom)(this.http.post('https://kauth.kakao.com/oauth/token', new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: this.config.get('KAKAO_REST_API_KEY') ?? '',
                redirect_uri: redirectUri,
                code,
            }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }));
            const { data: userInfo } = await (0, rxjs_1.firstValueFrom)(this.http.get('https://kapi.kakao.com/v2/user/me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            }));
            const id = String(userInfo.id);
            const email = userInfo.kakao_account?.email ?? null;
            const name = userInfo.kakao_account?.profile?.nickname ?? '카카오 사용자';
            return this.upsertSocialUser(client_1.AuthProvider.KAKAO, id, email, name);
        }
        catch {
            throw new common_1.BadRequestException('카카오 로그인에 실패했어요.');
        }
    }
    async appleLogin(idToken, name) {
        try {
            const { sub, email } = await this.verifyAppleToken(idToken);
            return this.upsertSocialUser(client_1.AuthProvider.APPLE, sub, email ?? null, name?.trim() || 'Apple 사용자');
        }
        catch {
            throw new common_1.BadRequestException('Apple 로그인에 실패했어요.');
        }
    }
    async verifyAppleToken(idToken) {
        const [headerB64] = idToken.split('.');
        const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
        const { data: jwks } = await (0, rxjs_1.firstValueFrom)(this.http.get('https://appleid.apple.com/auth/keys'));
        const appleKey = jwks.keys.find((k) => k.kid === header.kid);
        if (!appleKey)
            throw new Error('일치하는 Apple 공개키가 없어요.');
        const publicKey = crypto.createPublicKey({ key: appleKey, format: 'jwk' });
        const pem = publicKey.export({ type: 'spki', format: 'pem' });
        const clientId = this.config.get('APPLE_CLIENT_ID');
        const payload = jwt.verify(idToken, pem, {
            algorithms: ['RS256'],
            issuer: 'https://appleid.apple.com',
            ...(clientId ? { audience: clientId } : {}),
        });
        if (!payload.sub)
            throw new Error('sub 없음');
        return payload;
    }
    async upsertSocialUser(provider, providerId, email, name) {
        let user = await this.prisma.user.findFirst({ where: { provider, providerId } });
        if (!user) {
            const deletedByProvider = await this.prisma.deletedAccount.findFirst({
                where: { provider, providerId, canRejoinAt: { gt: new Date() } },
            });
            if (deletedByProvider) {
                const days = Math.ceil((deletedByProvider.canRejoinAt.getTime() - Date.now()) / 86400000);
                throw new common_1.ConflictException(`탈퇴 후 30일간 재가입이 제한돼요. ${days}일 후에 다시 시도해 주세요.`);
            }
            if (email) {
                const existing = await this.prisma.user.findFirst({ where: { email } });
                if (existing) {
                    const PROVIDER_LABEL = {
                        EMAIL: '이메일',
                        GOOGLE: '구글',
                        KAKAO: '카카오',
                        APPLE: '애플',
                    };
                    const usedProvider = PROVIDER_LABEL[existing.provider] ?? existing.provider;
                    throw new common_1.ConflictException(`이미 ${usedProvider}로 가입된 이메일이에요. ${usedProvider} 로그인을 이용해 주세요.`);
                }
            }
            user = await this.prisma.user.create({
                data: { provider, providerId, email, name },
            });
            this.creditService.grantSignupBonus(user.id).catch(() => { });
        }
        return this.issueTokens(user.id);
    }
    async refresh(refreshToken) {
        if (!refreshToken)
            throw new common_1.UnauthorizedException('토큰이 없어요.');
        const record = await this.prisma.refreshToken.findUnique({ where: { token: refreshToken } });
        if (!record || record.expiresAt < new Date())
            throw new common_1.UnauthorizedException('토큰이 만료됐어요.');
        return this.issueTokens(record.userId);
    }
    async logout(userId, refreshToken) {
        await this.prisma.refreshToken.deleteMany({ where: { userId, token: refreshToken } });
    }
    async issueTokens(userId) {
        const accessToken = this.jwt.sign({ sub: userId }, { expiresIn: '15m' });
        const refreshToken = this.jwt.sign({ sub: userId }, {
            secret: this.config.get('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
        });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await this.prisma.refreshToken.upsert({
            where: { token: refreshToken },
            create: { userId, token: refreshToken, expiresAt },
            update: { expiresAt },
        });
        return { accessToken, refreshToken };
    }
    async deleteAccount(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('사용자를 찾을 수 없어요.');
        const canRejoinAt = new Date();
        canRejoinAt.setDate(canRejoinAt.getDate() + 30);
        await this.prisma.deletedAccount.create({
            data: {
                provider: user.provider,
                providerId: user.providerId,
                email: user.email,
                canRejoinAt,
            },
        });
        await this.prisma.user.delete({ where: { id: userId } });
        return { success: true };
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.passwordHash)
            throw new common_1.BadRequestException('소셜 로그인 계정은 비밀번호를 변경할 수 없어요.');
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('현재 비밀번호가 맞지 않아요.');
        const hash = await bcrypt.hash(newPassword, 12);
        await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
        return { success: true };
    }
    async getMe(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                nickname: true,
                avatarUrl: true,
                gender: true,
                preferredVibes: true,
                isProfileComplete: true,
                status: true,
                isAdmin: true,
                suspendedUntil: true,
                suspendReason: true,
                credits: true,
                createdAt: true,
                subscriptions: {
                    where: { expiresAt: { gt: new Date() } },
                    take: 1,
                    select: { id: true },
                },
            },
        });
        if (!user)
            return null;
        const { subscriptions, ...rest } = user;
        const couple = await this.prisma.couple.findFirst({
            where: { status: 'ACTIVE', OR: [{ user1Id: userId }, { user2Id: userId }] },
            include: {
                user1: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
                user2: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
            },
        });
        let coupleInfo = null;
        if (couple) {
            const isUser1 = couple.user1Id === userId;
            const partner = isUser1 ? couple.user2 : couple.user1;
            coupleInfo = {
                coupleId: couple.id,
                partnerId: partner.id,
                partnerName: partner.nickname ?? partner.name,
                partnerAvatarUrl: partner.avatarUrl,
                creditShareEnabled: couple.creditShareEnabled,
                anniversaryDate: couple.anniversaryDate,
                createdAt: couple.createdAt,
            };
        }
        return { ...rest, isPremium: subscriptions.length > 0, couple: coupleInfo };
    }
    async checkNickname(nickname, userId) {
        const existing = await this.prisma.user.findFirst({
            where: { nickname, NOT: { id: userId } },
        });
        return { available: !existing };
    }
    async updateProfile(userId, data) {
        if (data.nickname) {
            const taken = await this.prisma.user.findFirst({
                where: { nickname: data.nickname, NOT: { id: userId } },
            });
            if (taken)
                throw new common_1.ConflictException('이미 사용 중인 닉네임이에요.');
        }
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.nickname !== undefined && { nickname: data.nickname }),
                ...(data.gender !== undefined && { gender: data.gender }),
                ...(data.preferredVibes !== undefined && { preferredVibes: data.preferredVibes }),
                isProfileComplete: true,
            },
            select: {
                id: true, email: true, name: true, nickname: true, gender: true,
                avatarUrl: true, preferredVibes: true, isProfileComplete: true,
                status: true, createdAt: true,
            },
        });
    }
    async updateAvatar(userId, base64) {
        const isPng = base64.startsWith('data:image/png');
        const ext = isPng ? 'png' : 'jpg';
        const mimeType = isPng ? 'image/png' : 'image/jpeg';
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const prev = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
        if (prev?.avatarUrl) {
            void this.r2.deleteByUrl(prev.avatarUrl);
        }
        const avatarUrl = await this.r2.upload(buffer, 'avatars', ext, mimeType);
        await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
        return { avatarUrl };
    }
    async resetAvatar(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
        if (user?.avatarUrl) {
            void this.r2.deleteByUrl(user.avatarUrl);
        }
        await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
        return { success: true };
    }
    async getStats(userId) {
        const [checkinCount, bookmarkCount, reviewCount] = await Promise.all([
            this.prisma.checkIn.count({ where: { userId } }),
            this.prisma.bookmark.count({ where: { userId } }),
            this.prisma.review.count({ where: { userId } }),
        ]);
        return { checkinCount, bookmarkCount, reviewCount };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        axios_1.HttpService,
        credit_service_1.CreditService,
        r2_service_1.R2Service])
], AuthService);
//# sourceMappingURL=auth.service.js.map
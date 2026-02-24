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
const rxjs_1 = require("rxjs");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    http;
    constructor(prisma, jwt, config, http) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.http = http;
    }
    async emailSignup(email, password, name) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing)
            throw new common_1.ConflictException('이미 사용 중인 이메일이에요.');
        const hash = await bcrypt.hash(password, 12);
        const user = await this.prisma.user.create({
            data: { email, name, provider: client_1.AuthProvider.EMAIL, passwordHash: hash },
        });
        return this.issueTokens(user.id);
    }
    async emailLogin(email, password) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash)
            throw new common_1.UnauthorizedException('이메일 또는 비밀번호가 맞지 않아요.');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('이메일 또는 비밀번호가 맞지 않아요.');
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
    async appleLogin(idToken) {
        try {
            const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
            const { sub, email } = payload;
            if (!sub)
                throw new Error('sub 없음');
            return this.upsertSocialUser(client_1.AuthProvider.APPLE, sub, email ?? null, 'Apple 사용자');
        }
        catch {
            throw new common_1.BadRequestException('Apple 로그인에 실패했어요.');
        }
    }
    async upsertSocialUser(provider, providerId, email, name) {
        let user = await this.prisma.user.findFirst({ where: { provider, providerId } });
        if (!user) {
            user = await this.prisma.user.create({
                data: { provider, providerId, email, name },
            });
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
        await this.prisma.refreshToken.create({
            data: { userId, token: refreshToken, expiresAt },
        });
        return { accessToken, refreshToken };
    }
    async getMe(userId) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                nickname: true,
                preferredVibes: true,
                isProfileComplete: true,
                status: true,
                createdAt: true,
            },
        });
    }
    async checkNickname(nickname, userId) {
        const existing = await this.prisma.user.findFirst({
            where: { nickname, NOT: { id: userId } },
        });
        return { available: !existing };
    }
    async updateProfile(userId, data) {
        const taken = await this.prisma.user.findFirst({
            where: { nickname: data.nickname, NOT: { id: userId } },
        });
        if (taken)
            throw new common_1.ConflictException('이미 사용 중인 닉네임이에요.');
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                nickname: data.nickname,
                preferredVibes: data.preferredVibes,
                isProfileComplete: true,
            },
            select: {
                id: true,
                email: true,
                name: true,
                nickname: true,
                preferredVibes: true,
                isProfileComplete: true,
                status: true,
                createdAt: true,
            },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        axios_1.HttpService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
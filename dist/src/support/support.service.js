"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const notification_service_1 = require("../notification/notification.service");
const FAQ_CATEGORIES = [
    {
        category: '앱 사용법',
        questions: [
            '체크인은 어떻게 하나요?',
            '바이브 리포트는 어떻게 확인하나요?',
            '장소 검색이 안 돼요',
            '북마크 기능은 어디에 있나요?',
        ],
    },
    {
        category: '계정',
        questions: [
            '비밀번호를 잊어버렸어요',
            '닉네임을 변경하고 싶어요',
            '계정 탈퇴는 어떻게 하나요?',
            '소셜 로그인 연동을 해제하고 싶어요',
        ],
    },
    {
        category: '결제/구독',
        questions: [
            '구독 취소는 어떻게 하나요?',
            '결제가 중복으로 됐어요',
            '구독 혜택이 적용 안 돼요',
            '환불 요청하고 싶어요',
        ],
    },
    {
        category: '오류/버그',
        questions: [
            '앱이 자꾸 꺼져요',
            '지도가 표시되지 않아요',
            '알림이 오지 않아요',
            '사진 업로드가 안 돼요',
        ],
    },
];
let SupportService = class SupportService {
    prisma;
    notificationService;
    constructor(prisma, notificationService) {
        this.prisma = prisma;
        this.notificationService = notificationService;
    }
    getFaqCategories() {
        return FAQ_CATEGORIES;
    }
    async createTicket(userId, title, body, type = 'CHAT') {
        const ticket = await this.prisma.supportTicket.create({
            data: { userId, title, body, type },
            select: {
                id: true,
                type: true,
                title: true,
                body: true,
                status: true,
                createdAt: true,
            },
        });
        if (type === 'CHAT') {
            await this.prisma.chatMessage.create({
                data: { ticketId: ticket.id, senderId: userId, isAdmin: false, body },
            });
        }
        return ticket;
    }
    async getMyTickets(userId) {
        return this.prisma.supportTicket.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                type: true,
                title: true,
                body: true,
                status: true,
                adminReply: true,
                repliedAt: true,
                createdAt: true,
                updatedAt: true,
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { body: true, isAdmin: true, createdAt: true },
                },
            },
        });
    }
    async getMessages(userId, ticketId) {
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
        });
        if (!ticket || ticket.userId !== userId)
            throw new common_1.ForbiddenException('접근할 수 없어요.');
        await this.prisma.chatMessage.updateMany({
            where: { ticketId, isAdmin: true, readAt: null },
            data: { readAt: new Date() },
        });
        return this.prisma.chatMessage.findMany({
            where: { ticketId },
            orderBy: { createdAt: 'asc' },
        });
    }
    async sendMessage(userId, ticketId, body, imageUrl) {
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
        });
        if (!ticket || ticket.userId !== userId)
            throw new common_1.ForbiddenException('접근할 수 없어요.');
        if (ticket.status === 'CLOSED')
            throw new common_1.ForbiddenException('종료된 채팅이에요.');
        const msg = await this.prisma.chatMessage.create({
            data: { ticketId, senderId: userId, isAdmin: false, body, imageUrl },
        });
        await this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { updatedAt: new Date() },
        });
        return msg;
    }
    async getAllTickets(adminId) {
        await this.assertAdmin(adminId);
        return this.prisma.supportTicket.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        nickname: true,
                        avatarUrl: true,
                    },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { body: true, isAdmin: true, createdAt: true, readAt: true },
                },
            },
        });
    }
    async getTicketMessages(adminId, ticketId) {
        await this.assertAdmin(adminId);
        await this.prisma.chatMessage.updateMany({
            where: { ticketId, isAdmin: false, readAt: null },
            data: { readAt: new Date() },
        });
        return this.prisma.chatMessage.findMany({
            where: { ticketId },
            orderBy: { createdAt: 'asc' },
        });
    }
    async adminSendMessage(adminId, ticketId, body, imageUrl) {
        await this.assertAdmin(adminId);
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
        });
        if (!ticket)
            throw new common_1.NotFoundException('문의를 찾을 수 없어요.');
        const msg = await this.prisma.chatMessage.create({
            data: { ticketId, senderId: adminId, isAdmin: true, body, imageUrl },
        });
        await this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: {
                status: 'IN_PROGRESS',
                adminReply: body,
                repliedAt: new Date(),
                updatedAt: new Date(),
            },
        });
        this.notificationService
            .send(ticket.userId, 'SUPPORT', '투닝 답변이 도착했어요 📬', `답변: ${body.length > 40 ? body.slice(0, 40) + '...' : body}`, { ticketId })
            .catch(() => { });
        return msg;
    }
    async replyTicket(adminId, ticketId, reply) {
        await this.assertAdmin(adminId);
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
        });
        if (!ticket)
            throw new common_1.NotFoundException('문의를 찾을 수 없어요.');
        return this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { adminReply: reply, repliedAt: new Date(), status: 'RESOLVED' },
        });
    }
    async updateTicketStatus(adminId, ticketId, status) {
        await this.assertAdmin(adminId);
        return this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: {
                status: status,
            },
        });
    }
    async getUsers(adminId) {
        await this.assertAdmin(adminId);
        return this.prisma.user.findMany({
            where: { status: { not: 'DELETED' } },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                name: true,
                nickname: true,
                avatarUrl: true,
                isAdmin: true,
                status: true,
                suspendedUntil: true,
                suspendReason: true,
                isProfileComplete: true,
                provider: true,
                createdAt: true,
                _count: { select: { checkIns: true, reviews: true, bookmarks: true } },
            },
        });
    }
    async suspendUser(adminId, targetId, reason, suspendedUntil) {
        await this.assertAdmin(adminId);
        const target = await this.prisma.user.findUnique({
            where: { id: targetId },
        });
        if (!target)
            throw new common_1.NotFoundException('사용자를 찾을 수 없어요.');
        if (target.isAdmin)
            throw new common_1.ForbiddenException('관리자는 정지할 수 없어요.');
        return this.prisma.user.update({
            where: { id: targetId },
            data: { status: 'SUSPENDED', suspendReason: reason, suspendedUntil },
            select: {
                id: true,
                name: true,
                status: true,
                suspendedUntil: true,
                suspendReason: true,
            },
        });
    }
    async unsuspendUser(adminId, targetId) {
        await this.assertAdmin(adminId);
        const target = await this.prisma.user.findUnique({
            where: { id: targetId },
        });
        if (!target)
            throw new common_1.NotFoundException('사용자를 찾을 수 없어요.');
        return this.prisma.user.update({
            where: { id: targetId },
            data: { status: 'ACTIVE', suspendReason: null, suspendedUntil: null },
            select: { id: true, name: true, status: true },
        });
    }
    async toggleAdmin(adminId, targetUserId) {
        await this.assertAdmin(adminId);
        const target = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });
        if (!target)
            throw new common_1.NotFoundException('사용자를 찾을 수 없어요.');
        return this.prisma.user.update({
            where: { id: targetUserId },
            data: { isAdmin: !target.isAdmin },
            select: { id: true, name: true, isAdmin: true },
        });
    }
    async getAdminStats(adminId) {
        await this.assertAdmin(adminId);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [totalUsers, newUsersThisWeek, totalTickets, openTickets, totalCheckIns, checkInsThisWeek, totalPlaces, activePlaces, totalReviews, recentUsers, recentCheckIns, popularPlaces,] = await Promise.all([
            this.prisma.user.count({
                where: { status: { not: client_1.UserStatus.DELETED } },
            }),
            this.prisma.user.count({
                where: {
                    createdAt: { gte: weekAgo },
                    status: { not: client_1.UserStatus.DELETED },
                },
            }),
            this.prisma.supportTicket.count(),
            this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
            this.prisma.checkIn.count(),
            this.prisma.checkIn.count({ where: { createdAt: { gte: weekAgo } } }),
            this.prisma.place.count(),
            this.prisma.place.count({ where: { isActive: true } }),
            this.prisma.review.count(),
            this.prisma.user.findMany({
                where: {
                    createdAt: { gte: weekAgo },
                    status: { not: client_1.UserStatus.DELETED },
                },
                select: { createdAt: true },
            }),
            this.prisma.checkIn.findMany({
                where: { createdAt: { gte: weekAgo } },
                select: { createdAt: true },
            }),
            this.prisma.place.findMany({
                where: { isActive: true },
                orderBy: { reviewCount: 'desc' },
                take: 5,
                select: {
                    id: true,
                    name: true,
                    category: true,
                    rating: true,
                    reviewCount: true,
                    _count: { select: { checkIns: true, bookmarks: true } },
                },
            }),
        ]);
        const groupByDay = (items) => {
            const map = new Map();
            items.forEach(({ createdAt }) => {
                const mm = String(createdAt.getMonth() + 1).padStart(2, '0');
                const dd = String(createdAt.getDate()).padStart(2, '0');
                const key = `${mm}-${dd}`;
                map.set(key, (map.get(key) ?? 0) + 1);
            });
            return Array.from(map.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, count]) => ({ date, count }));
        };
        return {
            totalUsers,
            newUsersThisWeek,
            totalTickets,
            openTickets,
            totalCheckIns,
            checkInsThisWeek,
            totalPlaces,
            activePlaces,
            totalReviews,
            usersByDay: groupByDay(recentUsers),
            checkinsByDay: groupByDay(recentCheckIns),
            popularPlaces,
        };
    }
    async getAdminPlaces(adminId) {
        await this.assertAdmin(adminId);
        return this.prisma.place.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                category: true,
                address: true,
                rating: true,
                reviewCount: true,
                vibeScore: true,
                isActive: true,
                createdAt: true,
                _count: { select: { checkIns: true, bookmarks: true, reviews: true } },
            },
        });
    }
    async togglePlaceActive(adminId, placeId) {
        await this.assertAdmin(adminId);
        const place = await this.prisma.place.findUnique({
            where: { id: placeId },
        });
        if (!place)
            throw new common_1.NotFoundException('장소를 찾을 수 없어요.');
        return this.prisma.place.update({
            where: { id: placeId },
            data: { isActive: !place.isActive },
            select: { id: true, name: true, isActive: true },
        });
    }
    async getAdminCheckIns(adminId, page = 1, limit = 30) {
        await this.assertAdmin(adminId);
        const [total, items] = await Promise.all([
            this.prisma.checkIn.count(),
            this.prisma.checkIn.findMany({
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: { id: true, name: true, nickname: true, avatarUrl: true },
                    },
                    place: { select: { id: true, name: true, category: true } },
                },
            }),
        ]);
        return { total, page, limit, items };
    }
    async deleteAdminCheckIn(adminId, checkInId) {
        await this.assertAdmin(adminId);
        const item = await this.prisma.checkIn.findUnique({
            where: { id: checkInId },
        });
        if (!item)
            throw new common_1.NotFoundException('체크인을 찾을 수 없어요.');
        await this.prisma.checkIn.delete({ where: { id: checkInId } });
        return { success: true };
    }
    async getAdminReviews(adminId, page = 1, limit = 30) {
        await this.assertAdmin(adminId);
        const [total, items] = await Promise.all([
            this.prisma.review.count(),
            this.prisma.review.findMany({
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: { id: true, name: true, nickname: true, avatarUrl: true },
                    },
                    place: { select: { id: true, name: true, category: true } },
                },
            }),
        ]);
        return { total, page, limit, items };
    }
    async deleteAdminReview(adminId, reviewId) {
        await this.assertAdmin(adminId);
        const item = await this.prisma.review.findUnique({
            where: { id: reviewId },
        });
        if (!item)
            throw new common_1.NotFoundException('리뷰를 찾을 수 없어요.');
        await this.prisma.review.delete({ where: { id: reviewId } });
        const remaining = await this.prisma.review.findMany({
            where: { placeId: item.placeId },
            select: { rating: true },
        });
        const newRating = remaining.length > 0
            ? remaining.reduce((s, r) => s + r.rating, 0) / remaining.length
            : 0;
        await this.prisma.place
            .update({
            where: { id: item.placeId },
            data: { rating: newRating, reviewCount: remaining.length },
        })
            .catch(() => { });
        return { success: true };
    }
    async assertAdmin(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { isAdmin: true },
        });
        if (!user?.isAdmin) {
            throw new common_1.ForbiddenException('관리자만 접근할 수 있어요.');
        }
    }
};
exports.SupportService = SupportService;
exports.SupportService = SupportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService])
], SupportService);
//# sourceMappingURL=support.service.js.map
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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const crypto_1 = require("crypto");
const support_service_1 = require("./support.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let SupportController = class SupportController {
    supportService;
    constructor(supportService) {
        this.supportService = supportService;
    }
    getFaqCategories() {
        return this.supportService.getFaqCategories();
    }
    createTicket(req, body) {
        return this.supportService.createTicket(req.user.id, body.title, body.body, body.type);
    }
    getMyTickets(req) {
        return this.supportService.getMyTickets(req.user.id);
    }
    getMessages(req, id) {
        return this.supportService.getMessages(req.user.id, id);
    }
    uploadImage(file) {
        return { imageUrl: `/public/support-images/${file.filename}` };
    }
    sendMessage(req, id, body) {
        return this.supportService.sendMessage(req.user.id, id, body.body, body.imageUrl);
    }
    getAllTickets(req) {
        return this.supportService.getAllTickets(req.user.id);
    }
    getTicketMessages(req, id) {
        return this.supportService.getTicketMessages(req.user.id, id);
    }
    adminSendMessage(req, id, body) {
        return this.supportService.adminSendMessage(req.user.id, id, body.body, body.imageUrl);
    }
    replyTicket(req, id, body) {
        return this.supportService.replyTicket(req.user.id, id, body.reply);
    }
    updateTicketStatus(req, id, body) {
        return this.supportService.updateTicketStatus(req.user.id, id, body.status);
    }
    getUsers(req) {
        return this.supportService.getUsers(req.user.id);
    }
    suspendUser(req, id, body) {
        return this.supportService.suspendUser(req.user.id, id, body.reason, new Date(body.suspendedUntil));
    }
    unsuspendUser(req, id) {
        return this.supportService.unsuspendUser(req.user.id, id);
    }
    toggleAdmin(req, id) {
        return this.supportService.toggleAdmin(req.user.id, id);
    }
    getAdminStats(req) {
        return this.supportService.getAdminStats(req.user.id);
    }
    getAdminPlaces(req) {
        return this.supportService.getAdminPlaces(req.user.id);
    }
    togglePlaceActive(req, id) {
        return this.supportService.togglePlaceActive(req.user.id, id);
    }
    getAdminCheckIns(req, page, limit) {
        return this.supportService.getAdminCheckIns(req.user.id, page ? Number(page) : 1, limit ? Number(limit) : 30);
    }
    deleteAdminCheckIn(req, id) {
        return this.supportService.deleteAdminCheckIn(req.user.id, id);
    }
    getAdminReviews(req, page, limit) {
        return this.supportService.getAdminReviews(req.user.id, page ? Number(page) : 1, limit ? Number(limit) : 30);
    }
    deleteAdminReview(req, id) {
        return this.supportService.deleteAdminReview(req.user.id, id);
    }
};
exports.SupportController = SupportController;
__decorate([
    (0, common_1.Get)('faq-categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getFaqCategories", null);
__decorate([
    (0, common_1.Post)('tickets'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "createTicket", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('tickets/mine'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getMyTickets", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('tickets/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('upload-image'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image', {
        storage: (0, multer_1.diskStorage)({
            destination: './public/support-images',
            filename: (_req, file, cb) => cb(null, `${(0, crypto_1.randomUUID)()}${(0, path_1.extname)(file.originalname)}`),
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype.startsWith('image/'))
                return cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "uploadImage", null);
__decorate([
    (0, common_1.Post)('tickets/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "sendMessage", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('admin/tickets'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getAllTickets", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('admin/tickets/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getTicketMessages", null);
__decorate([
    (0, common_1.Post)('admin/tickets/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "adminSendMessage", null);
__decorate([
    (0, common_1.Patch)('admin/tickets/:id/reply'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "replyTicket", null);
__decorate([
    (0, common_1.Patch)('admin/tickets/:id/status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "updateTicketStatus", null);
__decorate([
    (0, common_1.Get)('admin/users'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Patch)('admin/users/:id/suspend'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "suspendUser", null);
__decorate([
    (0, common_1.Patch)('admin/users/:id/unsuspend'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "unsuspendUser", null);
__decorate([
    (0, common_1.Patch)('admin/users/:id/toggle-admin'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "toggleAdmin", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('admin/stats'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getAdminStats", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('admin/places'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getAdminPlaces", null);
__decorate([
    (0, common_1.Patch)('admin/places/:id/toggle-active'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "togglePlaceActive", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('admin/checkins'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getAdminCheckIns", null);
__decorate([
    (0, common_1.Delete)('admin/checkins/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "deleteAdminCheckIn", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('admin/reviews'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getAdminReviews", null);
__decorate([
    (0, common_1.Delete)('admin/reviews/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "deleteAdminReview", null);
exports.SupportController = SupportController = __decorate([
    (0, swagger_1.ApiTags)('Support'),
    (0, common_1.Controller)('support'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [support_service_1.SupportService])
], SupportController);
//# sourceMappingURL=support.controller.js.map
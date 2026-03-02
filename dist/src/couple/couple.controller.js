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
exports.CoupleController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const couple_service_1 = require("./couple.service");
let CoupleController = class CoupleController {
    coupleService;
    constructor(coupleService) {
        this.coupleService = coupleService;
    }
    getMe(req) {
        return this.coupleService.getMyCoupleInfo(req.user.id);
    }
    searchUser(req, q) {
        return this.coupleService.searchUserForInvite(q ?? '', req.user.id);
    }
    sendInvitation(req, body) {
        return this.coupleService.sendInvitation(req.user.id, body.receiverId, body.message);
    }
    getReceivedInvitations(req) {
        return this.coupleService.getReceivedInvitations(req.user.id);
    }
    getSentInvitations(req) {
        return this.coupleService.getSentInvitations(req.user.id);
    }
    respondToInvitation(req, id, body) {
        return this.coupleService.respondToInvitation(id, req.user.id, body.accept);
    }
    cancelInvitation(req, id) {
        return this.coupleService.cancelInvitation(id, req.user.id);
    }
    dissolveCouple(req) {
        return this.coupleService.dissolveCouple(req.user.id);
    }
    toggleCreditShare(req, body) {
        return this.coupleService.toggleCreditShare(req.user.id, body.enabled);
    }
    transferCredits(req, body) {
        return this.coupleService.transferCreditsToPartner(req.user.id, body.amount);
    }
    getCreditHistory(req) {
        return this.coupleService.getCreditHistory(req.user.id);
    }
    getPartnerBookmarks(req) {
        return this.coupleService.getPartnerBookmarks(req.user.id);
    }
    getPartnerProfile(req) {
        return this.coupleService.getPartnerProfile(req.user.id);
    }
    setAnniversary(req, body) {
        return this.coupleService.setAnniversaryDate(req.user.id, new Date(body.anniversaryDate));
    }
    getDatePlans(req) {
        return this.coupleService.getDatePlans(req.user.id);
    }
    createDatePlan(req, body) {
        return this.coupleService.createDatePlan(req.user.id, {
            title: body.title,
            dateAt: new Date(body.dateAt),
            memo: body.memo,
            placeIds: body.placeIds,
        });
    }
    updateDatePlan(req, id, body) {
        return this.coupleService.updateDatePlan(req.user.id, id, {
            ...body,
            dateAt: body.dateAt ? new Date(body.dateAt) : undefined,
        });
    }
    deleteDatePlan(req, id) {
        return this.coupleService.deleteDatePlan(req.user.id, id);
    }
    aiDateAnalysis(req, body) {
        return this.coupleService.aiDateAnalysis(req.user.id, body?.userNote);
    }
    aiRefineTimeline(req, body) {
        return this.coupleService.aiRefineTimeline(req.user.id, body.timeline, body.feedback);
    }
    getMemories(req, page, limit) {
        return this.coupleService.getMemories(req.user.id, +(page ?? 1), +(limit ?? 20));
    }
    uploadMemory(req, body) {
        return this.coupleService.uploadMemory(req.user.id, {
            base64: body.imageBase64,
            caption: body.caption,
            takenAt: body.takenAt ? new Date(body.takenAt) : undefined,
        });
    }
    deleteMemory(req, id) {
        return this.coupleService.deleteMemory(req.user.id, id);
    }
    reportUser(req, body) {
        return this.coupleService.reportUser(req.user.id, body);
    }
    adminGetUserReports(req, page, limit, unresolved) {
        return this.coupleService.adminGetUserReports(req.user.id, +(page ?? 1), +(limit ?? 30), unresolved === 'true');
    }
    adminResolveUserReport(req, id) {
        return this.coupleService.adminResolveUserReport(req.user.id, id);
    }
    adminGetCouples(req, page, limit, status) {
        return this.coupleService.adminGetCouples(req.user.id, +(page ?? 1), +(limit ?? 30), status);
    }
    adminDissolveCouple(req, id) {
        return this.coupleService.adminDissolveCouple(req.user.id, id);
    }
    getMessages(req, page, limit) {
        return this.coupleService.getMessages(req.user.id, +(page ?? 1), +(limit ?? 50));
    }
    sendMessage(req, body) {
        return this.coupleService.sendMessage(req.user.id, body);
    }
    markMessagesRead(req) {
        return this.coupleService.markMessagesRead(req.user.id);
    }
    aiDateChat(req, body) {
        return this.coupleService.aiDateChat(req.user.id, body.messages, body.lat, body.lng);
    }
};
exports.CoupleController = CoupleController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "getMe", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "searchUser", null);
__decorate([
    (0, common_1.Post)('invite'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "sendInvitation", null);
__decorate([
    (0, common_1.Get)('invitations/received'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "getReceivedInvitations", null);
__decorate([
    (0, common_1.Get)('invitations/sent'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "getSentInvitations", null);
__decorate([
    (0, common_1.Post)('invitations/:id/respond'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "respondToInvitation", null);
__decorate([
    (0, common_1.Delete)('invitations/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "cancelInvitation", null);
__decorate([
    (0, common_1.Delete)('dissolve'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "dissolveCouple", null);
__decorate([
    (0, common_1.Patch)('credit-share'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "toggleCreditShare", null);
__decorate([
    (0, common_1.Post)('transfer-credits'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "transferCredits", null);
__decorate([
    (0, common_1.Get)('credit-history'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "getCreditHistory", null);
__decorate([
    (0, common_1.Get)('partner/bookmarks'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "getPartnerBookmarks", null);
__decorate([
    (0, common_1.Get)('partner/profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "getPartnerProfile", null);
__decorate([
    (0, common_1.Patch)('anniversary'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "setAnniversary", null);
__decorate([
    (0, common_1.Get)('date-plans'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "getDatePlans", null);
__decorate([
    (0, common_1.Post)('date-plans'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "createDatePlan", null);
__decorate([
    (0, common_1.Patch)('date-plans/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "updateDatePlan", null);
__decorate([
    (0, common_1.Delete)('date-plans/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "deleteDatePlan", null);
__decorate([
    (0, common_1.Post)('date-plans/ai-analysis'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "aiDateAnalysis", null);
__decorate([
    (0, common_1.Post)('date-plans/ai-refine'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "aiRefineTimeline", null);
__decorate([
    (0, common_1.Get)('memories'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "getMemories", null);
__decorate([
    (0, common_1.Post)('memories'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "uploadMemory", null);
__decorate([
    (0, common_1.Delete)('memories/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "deleteMemory", null);
__decorate([
    (0, common_1.Post)('report'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "reportUser", null);
__decorate([
    (0, common_1.Get)('admin/user-reports'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('unresolved')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "adminGetUserReports", null);
__decorate([
    (0, common_1.Patch)('admin/user-reports/:id/resolve'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "adminResolveUserReport", null);
__decorate([
    (0, common_1.Get)('admin/list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "adminGetCouples", null);
__decorate([
    (0, common_1.Delete)('admin/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "adminDissolveCouple", null);
__decorate([
    (0, common_1.Get)('messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Patch)('messages/read'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "markMessagesRead", null);
__decorate([
    (0, common_1.Post)('date-plans/ai-chat'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CoupleController.prototype, "aiDateChat", null);
exports.CoupleController = CoupleController = __decorate([
    (0, swagger_1.ApiTags)('Couple'),
    (0, common_1.Controller)('couple'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [couple_service_1.CoupleService])
], CoupleController);
//# sourceMappingURL=couple.controller.js.map
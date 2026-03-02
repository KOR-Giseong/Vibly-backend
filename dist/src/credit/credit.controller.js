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
exports.CreditController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const credit_service_1 = require("./credit.service");
const app_config_service_1 = require("../config/app-config.service");
let CreditController = class CreditController {
    creditService;
    appConfigService;
    constructor(creditService, appConfigService) {
        this.creditService = creditService;
        this.appConfigService = appConfigService;
    }
    getBalance(req) {
        return this.creditService.getBalance(req.user.id);
    }
    watchAd(req) {
        return this.creditService.watchAd(req.user.id);
    }
    getAdWatchesToday(req) {
        return this.creditService.getAdWatchesToday(req.user.id).then((count) => ({
            adWatchesToday: count,
            maxAdWatches: 5,
        }));
    }
    getHistory(req, page, limit) {
        return this.creditService.getHistory(req.user.id, +(page ?? 1), +(limit ?? 20));
    }
    verifyPurchase(req, body) {
        return this.creditService.verifyPurchase(req.user.id, body.platform, body.productId, body.receiptData);
    }
    cancelSubscription(req) {
        return this.creditService.cancelSubscription(req.user.id);
    }
    adminGetUsers(req) {
        return this.creditService.adminGetUsersWithCredits(req.user.id);
    }
    adminAdjust(req, userId, body) {
        return this.creditService.adminAdjustCredits(req.user.id, userId, body.amount);
    }
    adminListSubscriptions(req, page, limit) {
        return this.creditService.adminListSubscriptions(req.user.id, +(page ?? 1), +(limit ?? 30));
    }
    adminGetSubscriptionHistory(req, page, limit) {
        return this.creditService.adminGetAllSubscriptions(req.user.id, +(page ?? 1), +(limit ?? 30));
    }
    adminGetCreditHistory(req, page, limit) {
        return this.creditService.adminGetCreditGrantHistory(req.user.id, +(page ?? 1), +(limit ?? 30));
    }
    adminBulkGrant(req, body) {
        return this.creditService.adminBulkGrantCredits(req.user.id, body.amount, body.note);
    }
    adminGrantSubscription(req, body) {
        return this.creditService.adminGrantSubscription(req.user.id, body.userId, body.type, body.durationDays);
    }
    adminRevokeSubscription(req, userId) {
        return this.creditService.adminRevokeSubscription(req.user.id, userId);
    }
    adminGetAppConfig(req) {
        if (!req.user?.isAdmin)
            throw new common_1.ForbiddenException('관리자만 접근할 수 있어요.');
        return this.appConfigService.getAll();
    }
    adminSetAppConfig(req, body) {
        if (!req.user?.isAdmin)
            throw new common_1.ForbiddenException('관리자만 접근할 수 있어요.');
        return this.appConfigService.set(body.key, body.value).then(() => ({ ok: true }));
    }
};
exports.CreditController = CreditController;
__decorate([
    (0, common_1.Get)('balance'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "getBalance", null);
__decorate([
    (0, common_1.Post)('watch-ad'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "watchAd", null);
__decorate([
    (0, common_1.Get)('ad-watches-today'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "getAdWatchesToday", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Post)('subscription/verify-purchase'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "verifyPurchase", null);
__decorate([
    (0, common_1.Delete)('subscription'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "cancelSubscription", null);
__decorate([
    (0, common_1.Get)('admin/users'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "adminGetUsers", null);
__decorate([
    (0, common_1.Patch)('admin/users/:id/adjust'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "adminAdjust", null);
__decorate([
    (0, common_1.Get)('admin/subscriptions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "adminListSubscriptions", null);
__decorate([
    (0, common_1.Get)('admin/subscriptions/history'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "adminGetSubscriptionHistory", null);
__decorate([
    (0, common_1.Get)('admin/credit-history'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "adminGetCreditHistory", null);
__decorate([
    (0, common_1.Post)('admin/bulk-grant'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "adminBulkGrant", null);
__decorate([
    (0, common_1.Post)('admin/subscriptions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "adminGrantSubscription", null);
__decorate([
    (0, common_1.Delete)('admin/subscriptions/:userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "adminRevokeSubscription", null);
__decorate([
    (0, common_1.Get)('admin/app-config'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "adminGetAppConfig", null);
__decorate([
    (0, common_1.Patch)('admin/app-config'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "adminSetAppConfig", null);
exports.CreditController = CreditController = __decorate([
    (0, swagger_1.ApiTags)('Credit'),
    (0, common_1.Controller)('credits'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [credit_service_1.CreditService,
        app_config_service_1.AppConfigService])
], CreditController);
//# sourceMappingURL=credit.controller.js.map
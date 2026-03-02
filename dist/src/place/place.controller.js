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
exports.PlaceController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const place_service_1 = require("./place.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const optional_jwt_auth_guard_1 = require("../auth/guards/optional-jwt-auth.guard");
const checkin_dto_1 = require("./dto/checkin.dto");
const add_review_dto_1 = require("./dto/add-review.dto");
let PlaceController = class PlaceController {
    placeService;
    constructor(placeService) {
        this.placeService = placeService;
    }
    nearby(lat, lng, radius, limit, page) {
        return this.placeService.getNearby(+lat, +lng, +(radius ?? 2000), +(page ?? 1), +(limit ?? 20));
    }
    search(query, q, lat, lng, limit, page) {
        const keyword = query || q;
        return this.placeService.search(keyword, lat ? +lat : undefined, lng ? +lng : undefined, +(page ?? 1), +(limit ?? 20));
    }
    getBookmarks(req) {
        return this.placeService.getBookmarks(req.user.id);
    }
    getMyCheckins(req) {
        return this.placeService.getMyCheckins(req.user.id);
    }
    getById(req, id, name, lat, lng, mood, vibes) {
        const hint = name && lat && lng
            ? { name, lat: +lat, lng: +lng }
            : undefined;
        const vibesArray = vibes ? vibes.split(',').filter(Boolean) : undefined;
        return this.placeService.getById(id, req.user?.id, hint, mood, vibesArray);
    }
    bookmark(req, id, body) {
        return this.placeService.toggleBookmark(req.user.id, id, body?.imageUrl);
    }
    async checkIn(req, id, body, receipt) {
        return this.placeService.checkInWithReceipt(req.user.id, id, receipt?.buffer ?? null, body.mood, body.note, body.lat, body.lng);
    }
    getReviews(req, id, page, limit) {
        return this.placeService.getReviews(id, +(page ?? 1), +(limit ?? 20), req.user?.id);
    }
    addReview(req, id, body) {
        return this.placeService.addReview(req.user.id, id, body.rating, body.body);
    }
    likeReview(req, _placeId, reviewId) {
        return this.placeService.likeReview(req.user.id, reviewId);
    }
    unlikeReview(req, _placeId, reviewId) {
        return this.placeService.unlikeReview(req.user.id, reviewId);
    }
    getReviewSummary(req, id) {
        return this.placeService.getReviewSummary(id, req.user.id);
    }
    smartRecommend(req, body) {
        return this.placeService.smartRecommend(req.user.id, body.lat, body.lng, body.mode ?? 'nearby');
    }
};
exports.PlaceController = PlaceController;
__decorate([
    (0, common_1.Get)('nearby'),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __param(2, (0, common_1.Query)('radius')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "nearby", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('query')),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('lat')),
    __param(3, (0, common_1.Query)('lng')),
    __param(4, (0, common_1.Query)('limit')),
    __param(5, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('bookmarks'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "getBookmarks", null);
__decorate([
    (0, common_1.Get)('my-checkins'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "getMyCheckins", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(optional_jwt_auth_guard_1.OptionalJwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('name')),
    __param(3, (0, common_1.Query)('lat')),
    __param(4, (0, common_1.Query)('lng')),
    __param(5, (0, common_1.Query)('mood')),
    __param(6, (0, common_1.Query)('vibes')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(':id/bookmark'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "bookmark", null);
__decorate([
    (0, common_1.Post)(':id/checkin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('receipt')),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.UploadedFile)(new common_1.ParseFilePipe({
        validators: [
            new common_1.MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
            new common_1.FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|webp|heic)$/ }),
        ],
        errorHttpStatusCode: 422,
        fileIsRequired: false,
    }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, checkin_dto_1.CheckInDto, Object]),
    __metadata("design:returntype", Promise)
], PlaceController.prototype, "checkIn", null);
__decorate([
    (0, common_1.Get)(':id/reviews'),
    (0, common_1.UseGuards)(optional_jwt_auth_guard_1.OptionalJwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "getReviews", null);
__decorate([
    (0, common_1.Post)(':id/reviews'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_review_dto_1.AddReviewDto]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "addReview", null);
__decorate([
    (0, common_1.Post)(':id/reviews/:reviewId/like'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('reviewId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "likeReview", null);
__decorate([
    (0, common_1.Delete)(':id/reviews/:reviewId/like'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('reviewId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "unlikeReview", null);
__decorate([
    (0, common_1.Get)(':id/review-summary'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "getReviewSummary", null);
__decorate([
    (0, common_1.Post)('smart-recommend'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "smartRecommend", null);
exports.PlaceController = PlaceController = __decorate([
    (0, swagger_1.ApiTags)('Place'),
    (0, common_1.Controller)('places'),
    __metadata("design:paramtypes", [place_service_1.PlaceService])
], PlaceController);
//# sourceMappingURL=place.controller.js.map
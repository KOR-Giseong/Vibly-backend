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
const swagger_1 = require("@nestjs/swagger");
const place_service_1 = require("./place.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let PlaceController = class PlaceController {
    placeService;
    constructor(placeService) {
        this.placeService = placeService;
    }
    nearby(lat, lng, radius, page) {
        return this.placeService.getNearby(+lat, +lng, +(radius ?? 3), +(page ?? 1));
    }
    search(q, lat, lng, page) {
        return this.placeService.search(q, lat ? +lat : undefined, lng ? +lng : undefined, +(page ?? 1));
    }
    getBookmarks(req) {
        return this.placeService.getBookmarks(req.user.id);
    }
    getById(id) {
        return this.placeService.getById(id);
    }
    bookmark(req, id) {
        return this.placeService.toggleBookmark(req.user.id, id);
    }
    checkIn(req, id, body) {
        return this.placeService.checkIn(req.user.id, id, body.mood, body.note, body.imageUrl);
    }
};
exports.PlaceController = PlaceController;
__decorate([
    (0, common_1.Get)('nearby'),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __param(2, (0, common_1.Query)('radius')),
    __param(3, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "nearby", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('lat')),
    __param(2, (0, common_1.Query)('lng')),
    __param(3, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
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
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(':id/bookmark'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "bookmark", null);
__decorate([
    (0, common_1.Post)(':id/checkin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PlaceController.prototype, "checkIn", null);
exports.PlaceController = PlaceController = __decorate([
    (0, swagger_1.ApiTags)('Place'),
    (0, common_1.Controller)('places'),
    __metadata("design:paramtypes", [place_service_1.PlaceService])
], PlaceController);
//# sourceMappingURL=place.controller.js.map
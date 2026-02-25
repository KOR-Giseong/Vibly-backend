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
exports.MoodController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const mood_service_1 = require("./mood.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const mood_search_dto_1 = require("./dto/mood-search.dto");
let MoodController = class MoodController {
    moodService;
    constructor(moodService) {
        this.moodService = moodService;
    }
    search(req, body) {
        const userId = req.user?.id;
        return this.moodService.search(body.query, userId, body.lat, body.lng);
    }
    vibeReport(req, period) {
        return this.moodService.getVibeReport(req.user.id, period);
    }
};
exports.MoodController = MoodController;
__decorate([
    (0, common_1.Post)('search'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, mood_search_dto_1.MoodSearchDto]),
    __metadata("design:returntype", void 0)
], MoodController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('vibe-report'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MoodController.prototype, "vibeReport", null);
exports.MoodController = MoodController = __decorate([
    (0, swagger_1.ApiTags)('Mood'),
    (0, common_1.Controller)('mood'),
    __metadata("design:paramtypes", [mood_service_1.MoodService])
], MoodController);
//# sourceMappingURL=mood.controller.js.map
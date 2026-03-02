"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const app_config_module_1 = require("./config/app-config.module");
const auth_module_1 = require("./auth/auth.module");
const place_module_1 = require("./place/place.module");
const mood_module_1 = require("./mood/mood.module");
const analytics_module_1 = require("./analytics/analytics.module");
const support_module_1 = require("./support/support.module");
const community_module_1 = require("./community/community.module");
const credit_module_1 = require("./credit/credit.module");
const couple_module_1 = require("./couple/couple.module");
const notification_module_1 = require("./notification/notification.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot([
                { name: 'default', ttl: 60_000, limit: 120 },
                { name: 'auth', ttl: 900_000, limit: 10 },
            ]),
            prisma_module_1.PrismaModule,
            app_config_module_1.AppConfigModule,
            auth_module_1.AuthModule,
            place_module_1.PlaceModule,
            mood_module_1.MoodModule,
            analytics_module_1.AnalyticsModule,
            support_module_1.SupportModule,
            community_module_1.CommunityModule,
            credit_module_1.CreditModule,
            couple_module_1.CoupleModule,
            notification_module_1.NotificationModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
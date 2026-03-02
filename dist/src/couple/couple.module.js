"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoupleModule = void 0;
const common_1 = require("@nestjs/common");
const couple_controller_1 = require("./couple.controller");
const couple_service_1 = require("./couple.service");
const prisma_module_1 = require("../prisma/prisma.module");
const credit_module_1 = require("../credit/credit.module");
const place_module_1 = require("../place/place.module");
const notification_module_1 = require("../notification/notification.module");
const storage_module_1 = require("../storage/storage.module");
let CoupleModule = class CoupleModule {
};
exports.CoupleModule = CoupleModule;
exports.CoupleModule = CoupleModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, credit_module_1.CreditModule, place_module_1.PlaceModule, notification_module_1.NotificationModule, storage_module_1.StorageModule],
        controllers: [couple_controller_1.CoupleController],
        providers: [couple_service_1.CoupleService],
        exports: [couple_service_1.CoupleService],
    })
], CoupleModule);
//# sourceMappingURL=couple.module.js.map
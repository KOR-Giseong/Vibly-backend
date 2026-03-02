"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceModule = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const place_controller_1 = require("./place.controller");
const place_service_1 = require("./place.service");
const kakao_service_1 = require("./kakao.service");
const google_places_service_1 = require("./google-places.service");
const ocr_module_1 = require("../ocr/ocr.module");
const credit_module_1 = require("../credit/credit.module");
const notification_module_1 = require("../notification/notification.module");
let PlaceModule = class PlaceModule {
};
exports.PlaceModule = PlaceModule;
exports.PlaceModule = PlaceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            ocr_module_1.OcrModule,
            credit_module_1.CreditModule,
            notification_module_1.NotificationModule,
            platform_express_1.MulterModule.register({
                storage: (0, multer_1.memoryStorage)(),
                limits: { fileSize: 10 * 1024 * 1024 },
            }),
        ],
        controllers: [place_controller_1.PlaceController],
        providers: [place_service_1.PlaceService, kakao_service_1.KakaoService, google_places_service_1.GooglePlacesService],
        exports: [place_service_1.PlaceService, kakao_service_1.KakaoService, google_places_service_1.GooglePlacesService],
    })
], PlaceModule);
//# sourceMappingURL=place.module.js.map
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
exports.RegisterTokenDto = exports.DevicePlatform = void 0;
const class_validator_1 = require("class-validator");
var DevicePlatform;
(function (DevicePlatform) {
    DevicePlatform["IOS"] = "ios";
    DevicePlatform["ANDROID"] = "android";
})(DevicePlatform || (exports.DevicePlatform = DevicePlatform = {}));
class RegisterTokenDto {
    pushToken;
    platform;
}
exports.RegisterTokenDto = RegisterTokenDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterTokenDto.prototype, "pushToken", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(DevicePlatform),
    __metadata("design:type", String)
], RegisterTokenDto.prototype, "platform", void 0);
//# sourceMappingURL=register-token.dto.js.map
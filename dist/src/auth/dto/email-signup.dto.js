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
exports.EmailSignupDto = void 0;
const class_validator_1 = require("class-validator");
class EmailSignupDto {
    email;
    password;
    name;
}
exports.EmailSignupDto = EmailSignupDto;
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: '올바른 이메일 형식이 아니에요.' }),
    __metadata("design:type", String)
], EmailSignupDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8, { message: '비밀번호는 8자 이상이어야 해요.' }),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], EmailSignupDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: '이름을 입력해주세요.' }),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], EmailSignupDto.prototype, "name", void 0);
//# sourceMappingURL=email-signup.dto.js.map
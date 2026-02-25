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
exports.AddReviewDto = void 0;
const class_validator_1 = require("class-validator");
class AddReviewDto {
    rating;
    body;
}
exports.AddReviewDto = AddReviewDto;
__decorate([
    (0, class_validator_1.IsInt)({ message: '별점은 정수여야 해요.' }),
    (0, class_validator_1.Min)(1, { message: '별점은 1점 이상이어야 해요.' }),
    (0, class_validator_1.Max)(5, { message: '별점은 5점 이하여야 해요.' }),
    __metadata("design:type", Number)
], AddReviewDto.prototype, "rating", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: '리뷰 내용을 입력해주세요.' }),
    (0, class_validator_1.MaxLength)(1000, { message: '리뷰는 1000자 이하로 입력해주세요.' }),
    __metadata("design:type", String)
], AddReviewDto.prototype, "body", void 0);
//# sourceMappingURL=add-review.dto.js.map
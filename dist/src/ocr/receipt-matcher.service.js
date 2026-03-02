"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptMatcherService = void 0;
const common_1 = require("@nestjs/common");
const fuse_js_1 = __importDefault(require("fuse.js"));
let ReceiptMatcherService = class ReceiptMatcherService {
    BRANCH_SUFFIXES = /\s*(점|지점|점포|지店|본점|직영점|[0-9]+호점|[가-힣]+점)\s*$/;
    matchStoreName(lines, placeName) {
        const normalize = (s) => s
            .replace(this.BRANCH_SUFFIXES, '')
            .toLowerCase()
            .replace(/[^가-힣a-z0-9]/g, '')
            .trim();
        const normalizedTarget = normalize(placeName);
        if (!normalizedTarget) {
            return { matched: false, confidence: 0, extractedName: null };
        }
        const fuse = new fuse_js_1.default(lines, {
            includeScore: true,
            threshold: 0.5,
            minMatchCharLength: 2,
            getFn: (item) => normalize(item),
        });
        const results = fuse.search(normalizedTarget);
        if (!results.length) {
            return { matched: false, confidence: 0, extractedName: null };
        }
        const best = results[0];
        const confidence = 1 - (best.score ?? 1);
        const MATCH_THRESHOLD = 0.6;
        return {
            matched: confidence >= MATCH_THRESHOLD,
            confidence: Math.round(confidence * 100) / 100,
            extractedName: best.item,
        };
    }
};
exports.ReceiptMatcherService = ReceiptMatcherService;
exports.ReceiptMatcherService = ReceiptMatcherService = __decorate([
    (0, common_1.Injectable)()
], ReceiptMatcherService);
//# sourceMappingURL=receipt-matcher.service.js.map
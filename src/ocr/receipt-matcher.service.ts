import { Injectable } from '@nestjs/common';
import Fuse from 'fuse.js';

export interface MatchResult {
  matched: boolean;
  /** 0~1 사이 유사도 점수 (높을수록 유사) */
  confidence: number;
  /** OCR에서 가장 유사하게 인식된 텍스트 */
  extractedName: string | null;
}

@Injectable()
export class ReceiptMatcherService {
  /** 매장명 비교 시 제거할 공통 접미사 패턴 */
  private readonly BRANCH_SUFFIXES =
    /\s*(점|지점|점포|지店|본점|직영점|[0-9]+호점|[가-힣]+점)\s*$/;

  /**
   * OCR 텍스트 라인 목록에서 장소명과 퍼지 매칭합니다.
   * @param lines   영수증 OCR 텍스트 라인 배열
   * @param placeName DB에 저장된 장소명
   */
  matchStoreName(lines: string[], placeName: string): MatchResult {
    // 1. 정규화: 소문자, 특수문자 제거, 지점 접미사 제거
    const normalize = (s: string) =>
      s
        .replace(this.BRANCH_SUFFIXES, '')
        .toLowerCase()
        .replace(/[^가-힣a-z0-9]/g, '')
        .trim();

    const normalizedTarget = normalize(placeName);
    if (!normalizedTarget) {
      return { matched: false, confidence: 0, extractedName: null };
    }

    // 2. Fuse.js 설정: OCR 라인 목록에서 장소명과 가장 유사한 라인 검색
    const fuse = new Fuse(lines, {
      includeScore: true,
      threshold: 0.5, // 0: 완벽일치, 1: 모두허용
      minMatchCharLength: 2,
      getFn: (item) => normalize(item),
    });

    const results = fuse.search(normalizedTarget);
    if (!results.length) {
      return { matched: false, confidence: 0, extractedName: null };
    }

    // 3. 가장 유사한 결과의 점수 계산 (Fuse score: 낮을수록 좋음 → 반전)
    const best = results[0];
    const confidence = 1 - (best.score ?? 1);

    // 4. 60% 이상 유사도일 때 매칭 성공
    const MATCH_THRESHOLD = 0.6;

    return {
      matched: confidence >= MATCH_THRESHOLD,
      confidence: Math.round(confidence * 100) / 100,
      extractedName: best.item,
    };
  }
}

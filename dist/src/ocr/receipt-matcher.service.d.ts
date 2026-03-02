export interface MatchResult {
    matched: boolean;
    confidence: number;
    extractedName: string | null;
}
export declare class ReceiptMatcherService {
    private readonly BRANCH_SUFFIXES;
    matchStoreName(lines: string[], placeName: string): MatchResult;
}

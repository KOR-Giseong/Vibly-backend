import { BadRequestException } from '@nestjs/common';

/**
 * 비속어 / 성적 표현 필터
 * - 한국어 비속어 (초성/중성 변형 포함)
 * - 영어 비속어
 * - 숫자·기호 치환 leet speak 패턴 (ㅅ1ㅂ, s3x 등)
 */

const RAW_PATTERNS: RegExp[] = [
  // ── 한국어 비속어 ──────────────────────────────────────────────
  /시\s*발/,
  /씨\s*발/,
  /ㅅ[1i|!ㅣ]ㅂ/,
  /ㅆ[1i|!ㅣ]ㅂ/,
  /ㅅㅂ/,
  /ㅆㅂ/,
  /시팔/,
  /씨팔/,
  /병\s*신/,
  /ㅂ\s*ㅅ/,
  /개\s*새\s*끼/,
  /개새/,
  /ㄱ\s*ㅅ\s*ㄲ/,
  /새\s*끼/,
  /ㅅ\s*ㄲ/,
  /지\s*랄/,
  /ㅈ\s*ㄹ/,
  /미\s*친\s*놈/,
  /미\s*친\s*년/,
  /미\s*친\s*새/,
  /미쳤/,
  /ㅁ\s*ㅊ/,
  /존\s*나/,
  /졸\s*라/,
  /ㅈ\s*ㄴ/,
  /개\s*같/,
  /닥\s*쳐/,
  /ㄷ\s*ㅊ/,
  /꺼\s*져/,
  /뒤\s*져/,
  /뒤\s*지/,
  /죽\s*어/,
  /죽\s*여/,
  /죽\s*을/,
  /애\s*미/,
  /에\s*미/,
  /니\s*애\s*미/,
  /니\s*에\s*미/,
  /느\s*금\s*마/,
  /보\s*지/,
  /보\s*짓/,
  /자\s*지/,
  /ㅂ\s*ㅈ/,
  /창\s*녀/,
  /창\s*남/,
  /걸\s*레/,
  /년\s*놈/,

  // ── 성적 표현 ────────────────────────────────────────────────
  /섹\s*스/,
  /섹\s*시/,
  /야\s*동/,
  /포\s*르\s*노/,
  /포\s*르\s*녀/,
  /av\s*(배우|녀|남)/i,
  /성\s*기/,
  /성\s*행\s*위/,
  /성\s*관\s*계/,
  /자\s*위/,
  /항\s*문/,
  /삽\s*입/,
  /구\s*강\s*성\s*교/,
  /오\s*럴/,
  /딸\s*딸/,

  // ── 영어 비속어 / 성적 표현 ──────────────────────────────────
  /\bfuck(er|ing|ed|s)?\b/i,
  /\bs[e3]x(ual|y)?\b/i,
  /\bp[o0]rn(o)?\b/i,
  /\bb[i1]tch\b/i,
  /\bc[u*]nt\b/i,
  /\bsh[i1!]t\b/i,
  /\bd[i1]ck\b/i,
  /\bc[o0]ck\b/i,
  /\bp[e3]n[i1]s\b/i,
  /\bvagina\b/i,
  /\bnigger\b/i,
  /\bnigga\b/i,
  /\bfag(got)?\b/i,
  /\bwhore\b/i,
  /\bslut\b/i,
  /\bbastard\b/i,
  /\banus\b/i,
  /\bmasturbat/i,
];

/**
 * 비속어/성적 단어 포함 여부 확인
 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  // 공백·특수문자 제거 버전도 검사 (회피 시도 방지)
  const normalized = text.replace(/[\s\-_.*@#!?]/g, '');
  return RAW_PATTERNS.some((re) => re.test(text) || re.test(normalized));
}

/**
 * 비속어 포함 시 BadRequestException throw
 */
export function assertNoProfanity(text: string, fieldName = '내용'): void {
  if (containsProfanity(text)) {
    throw new BadRequestException(
      `${fieldName}에 부적절한 표현이 포함되어 있어요.`,
    );
  }
}

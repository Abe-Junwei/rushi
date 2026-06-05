import { splitGraphemes } from "./grapheme";

/** 与导出润色「标点」判断一致：Unicode 标点类 + 全角空格。 */
export function isPunctuationGrapheme(ch: string): boolean {
  return /\p{P}/u.test(ch) || ch === "\u3000";
}

/** 语段正文字数：字素数，不含标点（含空白）。 */
export function countTranscriptBodyCharacters(text: string): number {
  return splitGraphemes(text).filter((ch) => !isPunctuationGrapheme(ch)).length;
}

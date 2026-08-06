import type { CorrectionRuleRow } from "../tauri/correctionApi";
import { applyStableRulesToPolishLines } from "./exportPolishFinalize";
import { joinExportPolishLines } from "./exportDocxPolish.helpers";
import type { SegmentDto } from "../tauri/projectApi";
import { lineWouldHaveWordTrackMarkup } from "./exportPolishTrackMarkup";
import { graphemeCount as countGraphemes, splitGraphemes } from "./text/grapheme";

/** 从语段得到与导出一致的逐行正文（非空）。 */
export function segmentLinesFromSegments(segments: SegmentDto[]): string[] {
  return segments
    .map((s) => (s.text ?? "").trim())
    .filter((t) => t.length > 0);
}

/** 在调用 LLM 前生成可信正文（见 exportPolishFinalize）。 */
export function applyRulesToSegmentLines(
  lines: string[],
  rules: CorrectionRuleRow[],
) {
  return applyStableRulesToPolishLines(lines, rules);
}

/** 去掉标点与空白后对比（判断「仅标点/空格差异」）。 */
export function stripForPunctCompare(text: string): string {
  return [...text]
    .filter((ch) => {
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\u3000") {
        return false;
      }
      return !isPunctuationChar(ch);
    })
    .join("");
}

function isPunctuationChar(ch: string): boolean {
  return /\p{P}/u.test(ch);
}

/** LLM 行相对规则行是否仅为标点/空白差异。 */
export function isPunctuationOnlyLineDiff(before: string, after: string): boolean {
  if (before === after) return true;
  return stripForPunctCompare(before) === stripForPunctCompare(after);
}

export type ReconcileLlmLinesStats = {
  llmCount: number;
  segmentCount: number;
  paddedFromBefore: number;
  mergedSegmentPairs: number;
  /** 最终行仍采用导出前原文的语段下标（对齐时补原行）。 */
  paddedLineIndices: number[];
};

function levenshteinGraphemes(a: string, b: string): number {
  const ag = splitGraphemes(a);
  const bg = splitGraphemes(b);
  if (ag.length === 0) return bg.length;
  if (bg.length === 0) return ag.length;
  const m = ag.length;
  const n = bg.length;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) dp[j] = j;
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0] ?? 0;
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const temp = dp[j] ?? 0;
      dp[j] =
        ag[i - 1] === bg[j - 1] ? prev : 1 + Math.min(prev, dp[j] ?? 0, dp[j - 1] ?? 0);
      prev = temp;
    }
  }
  return dp[n] ?? Math.max(m, n);
}

/** 去标点后允许的净删除字素数（错字级）；更大净删回退原文，防干净稿丢句。 */
const MAX_NET_CONTENT_DELETE_GRAPHEMES = 2;

/** 本语段改动是否应进入 Word 修订轨（仅错字/标点，不含大段改写）。 */
export function lineEligibleForExportTrack(before: string, after: string): boolean {
  if (before === after) return false;
  if (isPunctuationOnlyLineDiff(before, after)) return true;
  const b = stripForPunctCompare(before);
  const a = stripForPunctCompare(after);
  if (b === a) return true;
  // LLM 常在长行内删掉中间几句且总编辑距离仍 ≤12%；禁止净删超过 typo 量级。
  if (countGraphemes(b) > countGraphemes(a) + MAX_NET_CONTENT_DELETE_GRAPHEMES) {
    return false;
  }
  const bLen = countGraphemes(b);
  const dist = levenshteinGraphemes(b, a);
  const maxLen = Math.max(bLen, countGraphemes(a), 1);
  return dist <= 4 || dist / maxLen <= 0.12;
}

export type ExportPolishContentGateResult = {
  lines: string[];
  /** 因正文字符变化而回退可信正文的行数和下标。 */
  revertedContentLines: number;
  revertedContentLineIndices: number[];
  /** ID/行数契约异常导致至少一批回退。 */
  contractFallback: boolean;
  contractFallbackLineIndices: number[];
};

function normalizeLineIndices(indices: number[], lineCount: number): number[] {
  return [...new Set(indices)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < lineCount)
    .sort((a, b) => a - b);
}

/**
 * LLM 只拥有标点与空白权限。可信正文来自原语段 + 本地稳定纠错规则；
 * 去标点后只要有一个正文字符不同，该行就回退，彻底阻断删句、摘要与改写。
 */
export function applyPunctuationOnlyExportPolish(
  trustedLines: string[],
  candidateLines: string[],
  contentContractValid: boolean,
  contractFallbackLineIndices: number[],
): ExportPolishContentGateResult {
  if (candidateLines.length !== trustedLines.length) {
    const allIndices = trustedLines.map((_, index) => index);
    return {
      lines: [...trustedLines],
      revertedContentLines: 0,
      revertedContentLineIndices: [],
      contractFallback: true,
      contractFallbackLineIndices: allIndices,
    };
  }

  let fallbackIndices = normalizeLineIndices(
    contractFallbackLineIndices,
    trustedLines.length,
  );
  // 兼容未返回细粒度下标的旧命令响应，仍然 fail-closed。
  if (!contentContractValid && fallbackIndices.length === 0) {
    fallbackIndices = trustedLines.map((_, index) => index);
  }
  const fallbackSet = new Set(fallbackIndices);
  const revertedContentLineIndices: number[] = [];
  const lines = trustedLines.map((trusted, index) => {
    if (fallbackSet.has(index)) return trusted;
    const candidate = candidateLines[index] ?? "";
    if (stripForPunctCompare(candidate) === stripForPunctCompare(trusted)) {
      return candidate;
    }
    revertedContentLineIndices.push(index);
    return trusted;
  });
  return {
    lines,
    revertedContentLines: revertedContentLineIndices.length,
    revertedContentLineIndices,
    contractFallback: fallbackIndices.length > 0,
    contractFallbackLineIndices: fallbackIndices,
  };
}

/** 最终硬不变量：行数一致，且每行去标点正文与可信正文逐字一致。 */
export function exportPolishLinesPreserveTrustedContent(
  trustedLines: string[],
  finalLines: string[],
): boolean {
  return (
    trustedLines.length === finalLines.length &&
    trustedLines.every(
      (trusted, index) =>
        stripForPunctCompare(trusted) === stripForPunctCompare(finalLines[index] ?? ""),
    )
  );
}

export type ExportPolishLineChange = {
  lineIndex: number;
  before: string;
  after: string;
  /** 修订轨是否会标出（与 before 不同）。 */
  hasTrackChange: boolean;
  /** 仅标点/空格变化。 */
  punctuationOnly: boolean;
};

export function buildExportPolishLineChanges(
  beforeLines: string[],
  finalLines: string[],
): ExportPolishLineChange[] {
  const n = Math.min(beforeLines.length, finalLines.length);
  const rows: ExportPolishLineChange[] = [];
  for (let i = 0; i < n; i += 1) {
    const before = beforeLines[i] ?? "";
    const after = finalLines[i] ?? "";
    if (before === after) continue;
    rows.push({
      lineIndex: i,
      before,
      after,
      hasTrackChange: lineWouldHaveWordTrackMarkup(before, after),
      punctuationOnly: isPunctuationOnlyLineDiff(before, after),
    });
  }
  return rows;
}

export function joinLinesForLlmBody(lines: string[]): string {
  return joinExportPolishLines(lines);
}

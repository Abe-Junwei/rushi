import type { CorrectionRuleRow } from "../tauri/correctionApi";
import { applyStableRulesToPolishLines } from "./exportPolishFinalize";
import { joinExportPolishLines } from "./exportDocxPolish.helpers";
import type { SegmentDto } from "../tauri/projectApi";
import { lineWouldHaveWordTrackMarkup } from "./exportPolishTrackMarkup";
import { graphemeCount as countGraphemes, splitGraphemes } from "./text/grapheme";

/** LLM 多行合并到最后一语段时的最大字数（字素）。 */
const MAX_MERGED_TAIL_GRAPHEMES = 8_000;

/** 从语段得到与导出一致的逐行正文（非空）。 */
export function segmentLinesFromSegments(segments: SegmentDto[]): string[] {
  return segments
    .map((s) => (s.text ?? "").trim())
    .filter((t) => t.length > 0);
}

/** 稳定规则覆盖（LLM 之后；见 exportPolishFinalize）。 */
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

function linesRoughlyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return stripForPunctCompare(a) === stripForPunctCompare(b);
}

export type ReconcileLlmLinesStats = {
  llmCount: number;
  segmentCount: number;
  paddedFromBefore: number;
  mergedSegmentPairs: number;
  /** 最终行仍采用导出前原文的语段下标（对齐时补原行）。 */
  paddedLineIndices: number[];
};

/**
 * 原样采纳 LLM 润色结果，并按语段数对齐（允许 LLM 少/多行：合并或补原行）。
 */
export function reconcileLlmPolishLines(
  beforeLines: string[],
  llmLines: string[],
): { lines: string[]; stats: ReconcileLlmLinesStats } {
  const segmentCount = beforeLines.length;
  const llmCount = llmLines.length;
  const stats: ReconcileLlmLinesStats = {
    llmCount,
    segmentCount,
    paddedFromBefore: 0,
    mergedSegmentPairs: 0,
    paddedLineIndices: [],
  };

  if (segmentCount === 0) return { lines: [], stats };
  if (llmCount === 0) {
    return {
      lines: [...beforeLines],
      stats: {
        ...stats,
        paddedFromBefore: segmentCount,
        paddedLineIndices: beforeLines.map((_, i) => i),
      },
    };
  }
  if (llmCount === segmentCount) {
    return { lines: [...llmLines], stats };
  }

  if (llmCount > segmentCount) {
    const head = llmLines.slice(0, segmentCount - 1);
    let tail = llmLines.slice(segmentCount - 1).join("");
    if (countGraphemes(tail) > MAX_MERGED_TAIL_GRAPHEMES) {
      tail = splitGraphemes(tail).slice(0, MAX_MERGED_TAIL_GRAPHEMES).join("");
    }
    return { lines: [...head, tail], stats };
  }

  const out: string[] = [];
  let bi = 0;
  let li = 0;
  while (bi < segmentCount) {
    if (li >= llmCount) {
      out.push(beforeLines[bi] ?? "");
      stats.paddedFromBefore += 1;
      stats.paddedLineIndices.push(bi);
      bi += 1;
      continue;
    }
    const b = beforeLines[bi] ?? "";
    const l = llmLines[li] ?? "";
    if (linesRoughlyMatch(b, l)) {
      out.push(l);
      bi += 1;
      li += 1;
      continue;
    }
    if (bi + 1 < segmentCount) {
      const mergedBefore = b + (beforeLines[bi + 1] ?? "");
      if (linesRoughlyMatch(mergedBefore, l)) {
        out.push(l);
        bi += 2;
        li += 1;
        stats.mergedSegmentPairs += 1;
        continue;
      }
    }
    if (segmentCount - bi > llmCount - li) {
      out.push(b);
      stats.paddedFromBefore += 1;
      stats.paddedLineIndices.push(bi);
      bi += 1;
      continue;
    }
    out.push(l);
    bi += 1;
    li += 1;
  }
  while (out.length < segmentCount) {
    const idx = out.length;
    out.push(beforeLines[idx] ?? "");
    stats.paddedFromBefore += 1;
    stats.paddedLineIndices.push(idx);
  }
  return { lines: out.slice(0, segmentCount), stats };
}

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

/** 本语段改动是否应进入 Word 修订轨（仅错字/标点，不含大段改写）。 */
export function lineEligibleForExportTrack(before: string, after: string): boolean {
  if (before === after) return false;
  if (isPunctuationOnlyLineDiff(before, after)) return true;
  const b = stripForPunctCompare(before);
  const a = stripForPunctCompare(after);
  if (b === a) return true;
  const dist = levenshteinGraphemes(b, a);
  const maxLen = Math.max(countGraphemes(b), countGraphemes(a), 1);
  return dist <= 4 || dist / maxLen <= 0.12;
}

/**
 * 定稿正文只保留「错别字 / 错误标点」级改动；超范围改写回退原文。
 * 本地 hygiene 与稳定纠错规则应在本函数之后应用。
 */
export function clampExportPolishLinesToEligible(
  beforeLines: string[],
  afterLines: string[],
): string[] {
  const n = Math.min(beforeLines.length, afterLines.length);
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const before = beforeLines[i] ?? "";
    const after = afterLines[i] ?? "";
    if (before === after || lineEligibleForExportTrack(before, after)) {
      out.push(after);
    } else {
      out.push(before);
    }
  }
  while (out.length < beforeLines.length) {
    out.push(beforeLines[out.length] ?? "");
  }
  return out;
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

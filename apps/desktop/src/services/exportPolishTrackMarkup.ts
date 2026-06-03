/**
 * 与 Rust `export_docx_polish_track` 对齐的修订轨可见性判断（预览用）。
 */
import { collapseOralFillerRuns, collapseOralStutter } from "./exportPolishHygiene";
import {
  isPunctuationOnlyLineDiff,
  stripForPunctCompare,
} from "./exportPolishPipeline";
import { graphemeCount, splitGraphemes } from "./text/grapheme";

const LCS_CELL_LIMIT = 2_500_000;
const MAX_HUNK_GRAPHEMES = 10;
const MAX_DELETION_ONLY_GRAPHEMES = 2;
const MAX_INSERTION_ONLY_GRAPHEMES = 2;

type DiffPiece = { kind: "same" | "del" | "ins"; text: string };

function isPunctuationChar(ch: string): boolean {
  return /\p{P}/u.test(ch) || ch === "\u3000";
}

function isPunctuationOnlyHunk(del: string, ins: string): boolean {
  if (stripForPunctCompare(del) !== stripForPunctCompare(ins)) return false;
  const allPunct = (s: string) =>
    [...s].every((ch) => /\s/u.test(ch) || isPunctuationChar(ch));
  return allPunct(del) && allPunct(ins);
}

function isLocalHygieneOnlyDiff(before: string, after: string): boolean {
  const normalized = collapseOralFillerRuns(collapseOralStutter(before));
  return normalized === after;
}

function levenshteinGraphemes(a: string, b: string): number {
  const ag = splitGraphemes(a);
  const bg = splitGraphemes(b);
  const n = ag.length;
  const m = bg.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) dp[i]![0] = i;
  for (let j = 0; j <= m; j += 1) dp[0]![j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost = ag[i - 1] === bg[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[n]![m]!;
}

function hanCoreEditRatio(before: string, after: string): { dist: number; maxLen: number } {
  const b = stripForPunctCompare(before);
  const a = stripForPunctCompare(after);
  const maxLen = Math.max(graphemeCount(b), graphemeCount(a), 1);
  if (b === a) return { dist: 0, maxLen };
  return { dist: levenshteinGraphemes(b, a), maxLen };
}

function hunkEligibleForExportTrack(del: string, ins: string): boolean {
  if (!del && !ins) return false;
  const hunkLen = graphemeCount(del) + graphemeCount(ins);
  if (hunkLen > MAX_HUNK_GRAPHEMES) return false;
  if (isLocalHygieneOnlyDiff(del, ins)) return true;
  if (isPunctuationOnlyHunk(del, ins)) return del !== ins;
  if (!ins) return graphemeCount(del) <= MAX_DELETION_ONLY_GRAPHEMES;
  if (!del) {
    return (
      graphemeCount(ins) <= MAX_INSERTION_ONLY_GRAPHEMES ||
      [...ins].every((ch) => isPunctuationChar(ch) || /\s/u.test(ch))
    );
  }
  const { dist, maxLen } = hanCoreEditRatio(del, ins);
  return dist <= 4 || dist / maxLen <= 0.12;
}

function diffEditOpsSingleInterval(before: string[], after: string[]): DiffPiece[] {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let bEnd = before.length;
  let aEnd = after.length;
  while (bEnd > prefix && aEnd > prefix && before[bEnd - 1] === after[aEnd - 1]) {
    bEnd -= 1;
    aEnd -= 1;
  }
  const out: DiffPiece[] = [];
  for (let i = 0; i < prefix; i += 1) out.push({ kind: "same", text: before[i]! });
  for (let i = prefix; i < bEnd; i += 1) out.push({ kind: "del", text: before[i]! });
  for (let i = prefix; i < aEnd; i += 1) out.push({ kind: "ins", text: after[i]! });
  for (let i = aEnd; i < after.length; i += 1) out.push({ kind: "same", text: after[i]! });
  return out;
}

function diffEditOps(before: string[], after: string[]): DiffPiece[] {
  const n = before.length;
  const m = after.length;
  if (n === 0 && m === 0) return [];
  if (n * m > LCS_CELL_LIMIT) return diffEditOpsSingleInterval(before, after);

  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      if (before[i - 1] === after[j - 1]) dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      else dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const ops: Array<"k" | "d" | "i"> = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && before[i - 1] === after[j - 1]) {
      ops.push("k");
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.push("i");
      j -= 1;
    } else {
      ops.push("d");
      i -= 1;
    }
  }
  ops.reverse();

  const out: DiffPiece[] = [];
  let bi = 0;
  let ai = 0;
  for (const op of ops) {
    if (op === "k") {
      out.push({ kind: "same", text: before[bi]! });
      bi += 1;
      ai += 1;
    } else if (op === "d") {
      out.push({ kind: "del", text: before[bi]! });
      bi += 1;
    } else {
      out.push({ kind: "ins", text: after[ai]! });
      ai += 1;
    }
  }
  return out;
}

function diffPiecesChar(before: string, after: string): DiffPiece[] {
  if (before === after) return [];
  return diffEditOps(splitGraphemes(before), splitGraphemes(after));
}

function filterCharDiffHunks(pieces: DiffPiece[]): DiffPiece[] {
  const out: DiffPiece[] = [];
  let i = 0;
  while (i < pieces.length) {
    const p = pieces[i]!;
    if (p.kind === "same") {
      out.push(p);
      i += 1;
      continue;
    }
    let del = "";
    let ins = "";
    while (i < pieces.length && pieces[i]!.kind !== "same") {
      if (pieces[i]!.kind === "del") del += pieces[i]!.text;
      if (pieces[i]!.kind === "ins") ins += pieces[i]!.text;
      i += 1;
    }
    if (hunkEligibleForExportTrack(del, ins)) {
      if (del) out.push({ kind: "del", text: del });
      if (ins) out.push({ kind: "ins", text: ins });
    } else if (ins) {
      out.push({ kind: "same", text: ins });
    }
  }
  return out;
}

function piecesHaveMarkup(pieces: DiffPiece[]): boolean {
  return pieces.some((p) => p.kind === "del" || p.kind === "ins");
}

function diffPiecesForExportTrack(before: string, after: string): DiffPiece[] {
  if (before === after) return [];
  if (isLocalHygieneOnlyDiff(before, after)) return diffPiecesChar(before, after);
  if (isPunctuationOnlyLineDiff(before, after)) return diffPiecesChar(before, after);
  const { dist, maxLen } = hanCoreEditRatio(before, after);
  if (dist <= 4 || dist / maxLen <= 0.12) return diffPiecesChar(before, after);
  return filterCharDiffHunks(diffPiecesChar(before, after));
}

/** 与 Word 导出修订轨一致：该行是否会出现 w:ins/w:del。 */
export function lineWouldHaveWordTrackMarkup(before: string, after: string): boolean {
  return piecesHaveMarkup(diffPiecesForExportTrack(before, after));
}

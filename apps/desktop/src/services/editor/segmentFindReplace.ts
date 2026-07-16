import type { SegmentDto } from "../../tauri/projectApi";
import { formatMediaTime, segmentStartSec } from "../../utils/formatMediaTime";

export type FindMatch = {
  /** 0-based index among all matches in the file */
  globalIndex: number;
  segmentIdx: number;
  charStart: number;
  charEnd: number;
};

export type ReplaceAllPreviewRow = {
  globalIndex: number;
  segmentIdx: number;
  segmentNumber: number;
  label: string;
  timeLabel: string;
  startTimeLabel: string;
  fullText: string;
  fullTextAfter: string;
  charStart: number;
  charEnd: number;
  beforeSnippet: string;
  afterSnippet: string;
  beforeDisplayText: string;
  beforeHighlightStart: number;
  beforeHighlightEnd: number;
  afterDisplayText: string;
  afterHighlightStart: number;
  afterHighlightEnd: number;
};

export type MatchDisplaySnippet = {
  displayText: string;
  highlightStart: number;
  highlightEnd: number;
};

/** 与 Welcome `build_content_snippet` / Word 导航结果一致。 */
export const DEFAULT_MATCH_SNIPPET_CONTEXT_CHARS = 24;

/** 浮窗列表：匹配/改区前保留有限上下文，尾部延至文末；可见宽度由 CSS truncate 随面板宽度变化。 */
export const PANEL_RESIZABLE_LIST_SNIPPET_OPTS = {
  align: "start",
  tailToEnd: true,
} as const;

export type FindMatchListItem = {
  globalIndex: number;
  segmentIdx: number;
  segmentNumber: number;
  timeLabel: string;
  startTimeLabel: string;
  fullText: string;
  charStart: number;
  charEnd: number;
  displayText: string;
  highlightStart: number;
  highlightEnd: number;
};

export function formatSegmentTimeLabel(seg: SegmentDto): string {
  const start = formatMediaTime(segmentStartSec(seg));
  const end = formatMediaTime(Math.max(seg.start_sec, seg.end_sec));
  return `${start} – ${end}`;
}

/** 浮窗列表左侧元信息：仅语段起点时间码。 */
export function formatSegmentStartTimeLabel(seg: SegmentDto): string {
  return formatMediaTime(segmentStartSec(seg));
}

/** 以匹配为中心截取上下文；高亮坐标相对 `displayText`（非全文）。
 * `align: "start"` 用于浮窗单行列表：匹配置于 snippet 前端，避免右侧 CSS 截断时高亮被隐藏。 */
export function buildMatchDisplaySnippet(
  text: string,
  charStart: number,
  charEnd: number,
  opts?: { contextChars?: number; align?: "start" | "center"; tailToEnd?: boolean },
): MatchDisplaySnippet {
  const contextChars = opts?.contextChars ?? DEFAULT_MATCH_SNIPPET_CONTEXT_CHARS;
  const align = opts?.align ?? "center";
  const tailToEnd = opts?.tailToEnd === true;
  if (!text) {
    return { displayText: "（空）", highlightStart: 0, highlightEnd: 0 };
  }
  const safeStart = Math.max(0, Math.min(charStart, text.length));
  const safeEnd = Math.max(safeStart, Math.min(charEnd, text.length));
  const chars = [...text];
  const left = align === "start" ? safeStart : Math.max(0, safeStart - contextChars);
  const right = tailToEnd ? chars.length : Math.min(chars.length, safeEnd + contextChars);
  const prefix = left > 0 ? "…" : "";
  const suffix = right < chars.length ? "…" : "";
  const displayText = `${prefix}${chars.slice(left, right).join("")}${suffix}`;
  const highlightStart = prefix.length + (safeStart - left);
  const highlightEnd = highlightStart + (safeEnd - safeStart);
  return { displayText, highlightStart, highlightEnd };
}

export function buildFindMatchListItems(segments: SegmentDto[], matches: FindMatch[]): FindMatchListItem[] {
  return matches.map((m) => {
    const seg = segments[m.segmentIdx];
    const fullText = seg?.text ?? "";
    const snippet = buildMatchDisplaySnippet(fullText, m.charStart, m.charEnd, PANEL_RESIZABLE_LIST_SNIPPET_OPTS);
    return {
      globalIndex: m.globalIndex,
      segmentIdx: m.segmentIdx,
      segmentNumber: m.segmentIdx + 1,
      timeLabel: seg ? formatSegmentTimeLabel(seg) : "—",
      startTimeLabel: seg ? formatSegmentStartTimeLabel(seg) : "—",
      fullText,
      charStart: m.charStart,
      charEnd: m.charEnd,
      displayText: snippet.displayText,
      highlightStart: snippet.highlightStart,
      highlightEnd: snippet.highlightEnd,
    };
  });
}

export function collectLiteralFindMatches(segments: SegmentDto[], query: string): FindMatch[] {
  if (!query) return [];
  const out: FindMatch[] = [];
  let globalIndex = 0;
  for (let segmentIdx = 0; segmentIdx < segments.length; segmentIdx++) {
    const seg = segments[segmentIdx];
    if (!seg || seg.frozen) continue;
    const text = seg.text ?? "";
    let start = 0;
    while (start <= text.length) {
      const at = text.indexOf(query, start);
      if (at < 0) break;
      out.push({
        globalIndex,
        segmentIdx,
        charStart: at,
        charEnd: at + query.length,
      });
      globalIndex += 1;
      start = at + query.length;
    }
  }
  return out;
}

export function replaceOnceInText(
  text: string,
  charStart: number,
  query: string,
  replacement: string,
): string {
  if (charStart < 0 || charStart + query.length > text.length) return text;
  return text.slice(0, charStart) + replacement + text.slice(charStart + query.length);
}

export function applyReplaceAllToSegments(
  segments: SegmentDto[],
  query: string,
  replacement: string,
  matches: FindMatch[],
): SegmentDto[] {
  if (!matches.length) return segments;
  const bySegment = new Map<number, FindMatch[]>();
  for (const m of matches) {
    const list = bySegment.get(m.segmentIdx) ?? [];
    list.push(m);
    bySegment.set(m.segmentIdx, list);
  }
  const next = [...segments];
  for (const [segmentIdx, segMatches] of bySegment) {
    const row = next[segmentIdx];
    if (!row || row.frozen) continue;
    const sorted = [...segMatches].sort((a, b) => b.charStart - a.charStart);
    let text = row.text;
    for (const m of sorted) {
      text = replaceOnceInText(text, m.charStart, query, replacement);
    }
    next[segmentIdx] = { ...row, text };
  }
  return next;
}

export function buildReplaceAllPreviewRows(
  segments: SegmentDto[],
  query: string,
  replacement: string,
  matches: FindMatch[],
): ReplaceAllPreviewRow[] {
  return matches.map((m) => {
    const text = segments[m.segmentIdx]?.text ?? "";
    const afterText = replaceOnceInText(text, m.charStart, query, replacement);
    const seg = segments[m.segmentIdx];
    const beforeSnip = buildMatchDisplaySnippet(text, m.charStart, m.charEnd, PANEL_RESIZABLE_LIST_SNIPPET_OPTS);
    const afterSnip = buildMatchDisplaySnippet(
      afterText,
      m.charStart,
      m.charStart + replacement.length,
      PANEL_RESIZABLE_LIST_SNIPPET_OPTS,
    );
    return {
      globalIndex: m.globalIndex,
      segmentIdx: m.segmentIdx,
      segmentNumber: m.segmentIdx + 1,
      label: `语段 ${m.segmentIdx + 1}`,
      timeLabel: seg ? formatSegmentTimeLabel(seg) : "—",
      startTimeLabel: seg ? formatSegmentStartTimeLabel(seg) : "—",
      fullText: text,
      fullTextAfter: afterText,
      charStart: m.charStart,
      charEnd: m.charEnd,
      beforeSnippet: beforeSnip.displayText,
      afterSnippet: afterSnip.displayText,
      beforeDisplayText: beforeSnip.displayText,
      beforeHighlightStart: beforeSnip.highlightStart,
      beforeHighlightEnd: beforeSnip.highlightEnd,
      afterDisplayText: afterSnip.displayText,
      afterHighlightStart: afterSnip.highlightStart,
      afterHighlightEnd: afterSnip.highlightEnd,
    };
  });
}

export function clampMatchIndex(index: number, matchCount: number): number {
  if (matchCount <= 0) return -1;
  if (index < 0) return 0;
  if (index >= matchCount) return matchCount - 1;
  return index;
}

export function matchPositionLabel(matchCount: number, activeMatchIndex: number): string {
  if (matchCount <= 0) return "无匹配";
  return `第 ${activeMatchIndex + 1}/${matchCount} 处`;
}

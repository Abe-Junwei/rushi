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
};

export type FindMatchListItem = {
  globalIndex: number;
  segmentIdx: number;
  segmentNumber: number;
  timeLabel: string;
  startTimeLabel: string;
  fullText: string;
  charStart: number;
  charEnd: number;
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

export function buildFindMatchListItems(segments: SegmentDto[], matches: FindMatch[]): FindMatchListItem[] {
  return matches.map((m) => {
    const seg = segments[m.segmentIdx];
    return {
      globalIndex: m.globalIndex,
      segmentIdx: m.segmentIdx,
      segmentNumber: m.segmentIdx + 1,
      timeLabel: seg ? formatSegmentTimeLabel(seg) : "—",
      startTimeLabel: seg ? formatSegmentStartTimeLabel(seg) : "—",
      fullText: seg?.text ?? "",
      charStart: m.charStart,
      charEnd: m.charEnd,
    };
  });
}

export function collectLiteralFindMatches(segments: SegmentDto[], query: string): FindMatch[] {
  if (!query) return [];
  const out: FindMatch[] = [];
  let globalIndex = 0;
  for (let segmentIdx = 0; segmentIdx < segments.length; segmentIdx++) {
    const text = segments[segmentIdx]?.text ?? "";
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
    if (!row) continue;
    const sorted = [...segMatches].sort((a, b) => b.charStart - a.charStart);
    let text = row.text;
    for (const m of sorted) {
      text = replaceOnceInText(text, m.charStart, query, replacement);
    }
    next[segmentIdx] = { ...row, text };
  }
  return next;
}

function snippetAround(text: string, charStart: number, spanLen: number, radius = 14): string {
  const lo = Math.max(0, charStart - radius);
  const hi = Math.min(text.length, charStart + spanLen + radius);
  const head = lo > 0 ? "…" : "";
  const tail = hi < text.length ? "…" : "";
  return `${head}${text.slice(lo, hi)}${tail}`;
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
      beforeSnippet: snippetAround(text, m.charStart, query.length),
      afterSnippet: snippetAround(afterText, m.charStart, replacement.length),
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

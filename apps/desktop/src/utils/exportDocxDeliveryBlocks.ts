import type { SegmentDto } from "../tauri/projectApi";
import { isSegmentFrozen } from "./frozenPlaybackSkip";

/** 交付正文连续块（冻结段打断）；`segmentCount` 为非空纳入段数量。 */
export type DeliveryTimeBlock = {
  startSec: number;
  endSec: number;
  segmentCount: number;
};

export type DocxDeliveryTimeBlockPayload = {
  startSec: number;
  endSec: number;
  unitCount: number;
};

function nonEmptyNonFrozen(seg: SegmentDto): boolean {
  return !isSegmentFrozen(seg) && (seg.text ?? "").trim().length > 0;
}

function blockFromSegments(rows: SegmentDto[]): DeliveryTimeBlock | null {
  if (rows.length === 0) return null;
  let startSec = Number.POSITIVE_INFINITY;
  let endSec = Number.NEGATIVE_INFINITY;
  for (const s of rows) {
    const a = Math.min(s.start_sec, s.end_sec);
    const b = Math.max(s.start_sec, s.end_sec);
    if (Number.isFinite(a)) startSec = Math.min(startSec, a);
    if (Number.isFinite(b)) endSec = Math.max(endSec, b);
  }
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec < startSec) {
    return null;
  }
  return { startSec, endSec, segmentCount: rows.length };
}

/**
 * 按 idx 遍历全量语段；冻结段打断连续块。仅统计非空、非冻结纳入段。
 */
export function resolveDocxDeliveryTimeBlocks(
  allSegments: readonly SegmentDto[],
): DeliveryTimeBlock[] {
  const sorted = [...allSegments].sort((a, b) => a.idx - b.idx);
  const blocks: DeliveryTimeBlock[] = [];
  let current: SegmentDto[] = [];

  const flush = () => {
    const block = blockFromSegments(current);
    if (block) blocks.push(block);
    current = [];
  };

  for (const seg of sorted) {
    if (isSegmentFrozen(seg)) {
      flush();
      continue;
    }
    if (nonEmptyNonFrozen(seg)) {
      current.push(seg);
    }
  }
  flush();
  return blocks;
}

export function deliveryBlocksHaveDiscontinuity(blocks: readonly DeliveryTimeBlock[]): boolean {
  return blocks.length > 1;
}

export function toDocxDeliveryTimeBlockPayload(
  blocks: readonly DeliveryTimeBlock[],
  unitCounts: readonly number[],
): DocxDeliveryTimeBlockPayload[] | null {
  if (blocks.length === 0) return null;
  if (unitCounts.length !== blocks.length) return null;
  return blocks.map((b, i) => ({
    startSec: b.startSec,
    endSec: b.endSec,
    unitCount: unitCounts[i] ?? 0,
  }));
}

/** 润色导出：在语段块末强制断自然段，避免一段横跨不连续时轴。 */
export function mergeExportPolishBreaksWithBlockBoundaries(
  lineCount: number,
  semanticBreakAfterLine: readonly number[],
  blocks: readonly DeliveryTimeBlock[],
): number[] {
  const forced = new Set(
    semanticBreakAfterLine.filter((i) => i >= 0 && i < lineCount - 1),
  );
  if (!deliveryBlocksHaveDiscontinuity(blocks)) {
    return [...forced].sort((a, b) => a - b);
  }
  let lineIdx = 0;
  for (let bi = 0; bi < blocks.length - 1; bi++) {
    lineIdx += blocks[bi]?.segmentCount ?? 0;
    const breakAfter = lineIdx - 1;
    if (breakAfter >= 0 && breakAfter < lineCount - 1) {
      forced.add(breakAfter);
    }
  }
  return [...forced].sort((a, b) => a - b);
}

function lineIndexToBlockIndex(blocks: readonly DeliveryTimeBlock[]): number[] {
  const out: number[] = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const n = blocks[bi]?.segmentCount ?? 0;
    for (let j = 0; j < n; j++) out.push(bi);
  }
  return out;
}

/** 按块统计润色自然段数（须已强制块边界断段）。 */
export function resolvePolishParagraphCountsPerBlock(
  paragraphCount: number,
  lineCount: number,
  breakAfterLine: readonly number[],
  blocks: readonly DeliveryTimeBlock[],
): number[] {
  const lineToBlock = lineIndexToBlockIndex(blocks);
  if (lineToBlock.length !== lineCount || paragraphCount === 0) {
    return [paragraphCount];
  }
  const breakSet = new Set(
    breakAfterLine.filter((i) => i >= 0 && i < lineCount - 1),
  );
  const counts = blocks.map(() => 0);
  let line = 0;
  for (let pi = 0; pi < paragraphCount; pi++) {
    const block = lineToBlock[line] ?? 0;
    counts[block] = (counts[block] ?? 0) + 1;
    if (pi < paragraphCount - 1) {
      while (line < lineCount - 1 && !breakSet.has(line)) line++;
      line++;
    }
  }
  return counts;
}

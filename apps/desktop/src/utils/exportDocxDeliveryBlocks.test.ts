import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  deliveryBlocksHaveDiscontinuity,
  mergeExportPolishBreaksWithBlockBoundaries,
  resolveDocxDeliveryTimeBlocks,
  resolvePolishParagraphCountsPerBlock,
  toDocxDeliveryTimeBlockPayload,
} from "./exportDocxDeliveryBlocks";

function seg(
  partial: Partial<SegmentDto> & Pick<SegmentDto, "idx" | "text" | "start_sec" | "end_sec">,
): SegmentDto {
  return {
    low_confidence: false,
    text_stage: "auto_transcribe",
    frozen: false,
    ...partial,
  };
}

describe("resolveDocxDeliveryTimeBlocks", () => {
  it("returns one block when no frozen interrupt", () => {
    const rows = [
      seg({ idx: 0, text: "a", start_sec: 0, end_sec: 2 }),
      seg({ idx: 1, text: "b", start_sec: 2, end_sec: 5 }),
    ];
    expect(resolveDocxDeliveryTimeBlocks(rows)).toEqual([
      { startSec: 0, endSec: 5, segmentCount: 2 },
    ]);
  });

  it("splits on frozen segments", () => {
    const rows = [
      seg({ idx: 0, text: "a", start_sec: 0, end_sec: 2 }),
      seg({ idx: 1, text: "x", start_sec: 2, end_sec: 4, frozen: true }),
      seg({ idx: 2, text: "b", start_sec: 10, end_sec: 12 }),
      seg({ idx: 3, text: "c", start_sec: 12, end_sec: 15 }),
    ];
    expect(resolveDocxDeliveryTimeBlocks(rows)).toEqual([
      { startSec: 0, endSec: 2, segmentCount: 1 },
      { startSec: 10, endSec: 15, segmentCount: 2 },
    ]);
    expect(deliveryBlocksHaveDiscontinuity(resolveDocxDeliveryTimeBlocks(rows))).toBe(true);
  });

  it("ignores empty non-frozen rows", () => {
    const rows = [
      seg({ idx: 0, text: "a", start_sec: 0, end_sec: 1 }),
      seg({ idx: 1, text: "  ", start_sec: 1, end_sec: 2 }),
      seg({ idx: 2, text: "b", start_sec: 2, end_sec: 3 }),
    ];
    expect(resolveDocxDeliveryTimeBlocks(rows)).toEqual([
      { startSec: 0, endSec: 3, segmentCount: 2 },
    ]);
  });
});

describe("polish block boundaries", () => {
  const blocks = [
    { startSec: 0, endSec: 2, segmentCount: 2 },
    { startSec: 10, endSec: 12, segmentCount: 1 },
  ];

  it("forces break after last line of each block", () => {
    expect(mergeExportPolishBreaksWithBlockBoundaries(3, [], blocks)).toEqual([1]);
    expect(
      mergeExportPolishBreaksWithBlockBoundaries(3, [0], blocks).sort((a, b) => a - b),
    ).toEqual([0, 1]);
  });

  it("emits payload for single continuous block", () => {
    const blocks = [{ startSec: 0, endSec: 5, segmentCount: 2 }];
    const payload = toDocxDeliveryTimeBlockPayload(blocks, [2]);
    expect(payload).toEqual([{ startSec: 0, endSec: 5, unitCount: 2 }]);
  });

  it("counts paragraphs per block after forced breaks", () => {
    const breaks = mergeExportPolishBreaksWithBlockBoundaries(3, [], blocks);
    const counts = resolvePolishParagraphCountsPerBlock(2, 3, breaks, blocks);
    expect(counts).toEqual([1, 1]);
    const payload = toDocxDeliveryTimeBlockPayload(blocks, counts);
    expect(payload).toEqual([
      { startSec: 0, endSec: 2, unitCount: 1 },
      { startSec: 10, endSec: 12, unitCount: 1 },
    ]);
  });
});

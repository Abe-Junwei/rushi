import { describe, expect, it } from "vitest";
import {
  buildDocxExportLayoutOptions,
  formatDocxFooterTranscribedDay,
} from "./exportDocxLayoutOptions";
import type { SegmentDto } from "../tauri/projectApi";

function seg(
  partial: Partial<SegmentDto> & Pick<SegmentDto, "text" | "start_sec" | "end_sec">,
): SegmentDto {
  return {
    idx: 0,
    low_confidence: false,
    text_stage: "auto_transcribe",
    frozen: false,
    ...partial,
  };
}

describe("buildDocxExportLayoutOptions", () => {
  const delivery = [
    seg({ idx: 0, text: "第一句", start_sec: 10, end_sec: 20 }),
    seg({ idx: 2, text: "第二句", start_sec: 25, end_sec: 35 }),
  ];

  it("lecture without discontinuity: span and single block payload", () => {
    const layout = buildDocxExportLayoutOptions({
      mode: "lecture",
      segments: delivery,
      allSegments: delivery,
      recordingFileName: "demo.wav",
      transcriber: "王五",
      includeProjectMetadata: false,
    });
    expect(layout.deliveryTimeBlocks).toEqual([
      { startSec: 10, endSec: 35, unitCount: 2 },
    ]);
    expect(layout.recordingFileName).toBe("demo.wav");
    expect(layout.footerTranscriberName).toBe("王五");
    expect(layout.footerTranscribedAt).toBe(formatDocxFooterTranscribedDay(new Date()));
  });

  it("formats footer transcribed day from exportedAt", () => {
    const layout = buildDocxExportLayoutOptions({
      mode: "clean",
      segments: delivery,
      allSegments: delivery,
      recordingFileName: "demo.wav",
      transcriber: "王五",
      includeProjectMetadata: false,
      exportedAt: new Date(2026, 6, 15, 18, 30),
    });
    expect(layout.footerTranscribedAt).toBe("2026-07-15");
  });

  it("omits footer transcriber when cover already includes it", () => {
    const layout = buildDocxExportLayoutOptions({
      mode: "clean",
      segments: delivery,
      allSegments: delivery,
      recordingFileName: "demo.wav",
      transcriber: "王五",
      includeProjectMetadata: true,
    });
    expect(layout.footerTranscriberName).toBeNull();
  });

  it("emits block payload when frozen interrupts timeline", () => {
    const all = [
      delivery[0],
      seg({ idx: 1, text: "冻", start_sec: 21, end_sec: 24, frozen: true }),
      delivery[1],
    ];
    const layout = buildDocxExportLayoutOptions({
      mode: "lecture",
      segments: delivery,
      allSegments: all,
      recordingFileName: "x.wav",
      transcriber: null,
      includeProjectMetadata: false,
    });
    expect(layout.deliveryTimeBlocks).toEqual([
      { startSec: 10, endSec: 20, unitCount: 1 },
      { startSec: 25, endSec: 35, unitCount: 1 },
    ]);
  });

  it("polish uses paragraph unit counts per block", () => {
    const all = [
      delivery[0],
      seg({ idx: 1, text: "冻", start_sec: 21, end_sec: 24, frozen: true }),
      delivery[1],
    ];
    const layout = buildDocxExportLayoutOptions({
      mode: "lecture",
      segments: delivery,
      allSegments: all,
      recordingFileName: "x.wav",
      transcriber: "",
      includeProjectMetadata: false,
      polishBlockUnitCounts: [2, 1],
    });
    expect(layout.deliveryTimeBlocks).toEqual([
      { startSec: 10, endSec: 20, unitCount: 2 },
      { startSec: 25, endSec: 35, unitCount: 1 },
    ]);
  });

  it("verbatim gets footer only, no span or blocks", () => {
    const layout = buildDocxExportLayoutOptions({
      mode: "verbatim",
      segments: delivery,
      allSegments: delivery,
      recordingFileName: "v.wav",
      transcriber: null,
      includeProjectMetadata: false,
    });
    expect(layout.deliveryTimeBlocks).toBeNull();
  });
});

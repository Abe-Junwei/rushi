import { describe, expect, it } from "vitest";
import {
  buildSegmentRowContextMenuItems,
  buildSegmentTextAppearanceMenuItem,
  isSegmentTextContextMenuKey,
} from "./segmentTextContextMenuModel";
import type { SegmentDto } from "../tauri/projectApi";

function seg(start: number, end: number): SegmentDto {
  return { uid: "u1", idx: 0, start_sec: start, end_sec: end, text: "x" };
}

const appearanceArgs = {
  appearanceDisabled: false,
  transcriptFontFamily: "Inter",
  transcriptFontWeight: 500 as const,
  transcriptFontItalic: false,
  transcriptFontPx: 14,
  fontSizeAtMin: false,
  fontSizeAtMax: false,
  fontOptions: ["Inter"],
};

describe("buildSegmentRowContextMenuItems", () => {
  it("shows correction memory and segment ops when text is deliberately selected", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10)],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "错词",
      appearance: appearanceArgs,
    });
    expect(items.map((i) => i.key)).toEqual([
      "addCorrectionMemory",
      "markFinalized",
      "delete",
      "mergePrev",
      "mergeNext",
    ]);
  });

  it("merges segment ops and text appearance without selection", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10)],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "",
      appearance: appearanceArgs,
    });
    expect(items.map((i) => i.key)).toEqual([
      "markFinalized",
      "delete",
      "mergePrev",
      "mergeNext",
      "appearance",
    ]);
  });

  it("waveform menu keeps split and omits text appearance", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10)],
      busy: false,
      pointerTimeSec: 5,
      origin: "waveform",
      selectionText: "",
      appearance: appearanceArgs,
    });
    expect(items.map((i) => i.key)).toContain("splitAtPointer");
    expect(items.map((i) => i.key)).not.toContain("appearance");
  });
});

describe("buildSegmentTextAppearanceMenuItem", () => {
  it("builds nested appearance menu", () => {
    const item = buildSegmentTextAppearanceMenuItem({
      ...appearanceArgs,
      transcriptFontFamily: "Noto Serif SC",
      transcriptFontWeight: 700,
      transcriptFontItalic: true,
      fontOptions: ["Noto Serif SC", "Inter"],
    });
    expect(item.label).toBe("文本外观");
    expect(item.children?.map((c) => c.label)).toEqual([
      "字体",
      "减小字号 (14px)",
      "增大字号",
      "加粗",
      "斜体",
    ]);
    expect(item.children?.[3]?.checked).toBe(true);
    expect(item.children?.[4]?.checked).toBe(true);
  });
});

describe("isSegmentTextContextMenuKey", () => {
  it("recognizes actionable keys", () => {
    expect(isSegmentTextContextMenuKey("toggleBold")).toBe(true);
    expect(isSegmentTextContextMenuKey("fontSizeDecrease")).toBe(true);
    expect(isSegmentTextContextMenuKey("font:Inter")).toBe(true);
    expect(isSegmentTextContextMenuKey("appearance")).toBe(false);
  });
});

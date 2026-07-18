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
  fontOptions: ["Inter"],
};

describe("buildSegmentRowContextMenuItems", () => {
  it("orders freeze → annotation → clipboard → memory → structure when text is selected", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10), seg(10, 20)],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "错词",
      hasClipboardText: true,
      appearance: appearanceArgs,
    });
    expect(items.map((i) => i.key)).toEqual([
      "toggleFreeze",
      "editAnnotation",
      "copyText",
      "cutText",
      "pasteText",
      "addCorrectionMemory",
      "markFirstProof",
      "markFinalized",
      "mergeNext",
      "delete",
    ]);
    expect(items.every((i) => !i.disabled)).toBe(true);
  });

  it("orders freeze → annotation → paste → structure → appearance without selection", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10), seg(10, 20)],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "",
      hasClipboardText: true,
      appearance: appearanceArgs,
    });
    expect(items.map((i) => i.key)).toEqual([
      "toggleFreeze",
      "editAnnotation",
      "pasteText",
      "markFirstProof",
      "markFinalized",
      "mergeNext",
      "delete",
      "appearance",
    ]);
  });

  it("waveform menu keeps freeze first and omits text appearance", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10)],
      busy: false,
      pointerTimeSec: 5,
      origin: "waveform",
      selectionText: "",
      hasClipboardText: true,
      appearance: appearanceArgs,
    });
    expect(items.map((i) => i.key)[0]).toBe("toggleFreeze");
    expect(items.map((i) => i.key)).toContain("splitAtPointer");
    expect(items.map((i) => i.key)).not.toContain("appearance");
    expect(items.map((i) => i.key)).not.toContain("editAnnotation");
    expect(items.map((i) => i.key)).not.toContain("copyText");
  });

  it("hides structure and edit actions when segment is frozen", () => {
    const frozen = { ...seg(0, 10), frozen: true };
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [frozen],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "",
      hasClipboardText: true,
      appearance: appearanceArgs,
    });
    expect(items.map((i) => i.key)).toEqual(["toggleFreeze", "editAnnotation"]);
    expect(items.find((i) => i.key === "toggleFreeze")?.label).toBe("解冻语段");
  });

  it("keeps copy but hides cut/paste when frozen with a text selection", () => {
    const frozen = { ...seg(0, 10), frozen: true };
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [frozen],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "保留",
      hasClipboardText: true,
      appearance: appearanceArgs,
    });
    expect(items.map((i) => i.key)).toEqual(["toggleFreeze", "editAnnotation", "copyText"]);
  });

  it("shows shortcut hints on annotation and correction memory items", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10), seg(10, 20)],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "错词",
      hasClipboardText: true,
      appearance: appearanceArgs,
    });
    expect(items.find((i) => i.key === "copyText")?.shortcutHint).toBe("Ctrl+C");
    expect(items.find((i) => i.key === "cutText")?.shortcutHint).toBe("Ctrl+X");
    expect(items.find((i) => i.key === "pasteText")?.shortcutHint).toBe("Ctrl+V");
    expect(items.find((i) => i.key === "editAnnotation")?.shortcutHint).toBe("Ctrl+N");
    expect(items.find((i) => i.key === "addCorrectionMemory")?.shortcutHint).toBe("Shift+Ctrl+L");
    expect(items.find((i) => i.key === "mergeNext")?.shortcutHint).toBe("Ctrl+J");
  });

  it("shows edit annotation label when segment has annotation", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [{ ...seg(0, 10), annotation: "note" }],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "",
      hasClipboardText: true,
      appearance: appearanceArgs,
    });
    expect(items.find((i) => i.key === "editAnnotation")?.label).toBe("编辑备注…");
  });

  it("omits copy and cut when there is no text selection", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10)],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "",
      hasClipboardText: true,
      appearance: appearanceArgs,
    });
    expect(items.find((i) => i.key === "copyText")).toBeUndefined();
    expect(items.find((i) => i.key === "cutText")).toBeUndefined();
    expect(items.find((i) => i.key === "pasteText")?.disabled).toBe(false);
  });

  it("omits paste when the clipboard has no text", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10)],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "",
      hasClipboardText: false,
      appearance: appearanceArgs,
    });
    expect(items.find((i) => i.key === "pasteText")).toBeUndefined();
  });

  it("still shows copy/cut with an empty clipboard when text is selected", () => {
    const items = buildSegmentRowContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10)],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
      selectionText: "错词",
      hasClipboardText: false,
      appearance: appearanceArgs,
    });
    expect(items.find((i) => i.key === "copyText")).toBeDefined();
    expect(items.find((i) => i.key === "cutText")).toBeDefined();
    expect(items.find((i) => i.key === "pasteText")).toBeUndefined();
  });
});

describe("buildSegmentTextAppearanceMenuItem", () => {
  it("builds nested appearance menu", () => {
    const item = buildSegmentTextAppearanceMenuItem({
      ...appearanceArgs,
      transcriptFontFamily: "Noto Serif SC",
      transcriptFontWeight: 700,
      transcriptFontItalic: true,
      fontOptions: ["Noto Serif SC", "PingFang SC"],
      fontDisplayLabels: {
        "Noto Serif SC": "思源宋体-简",
        "PingFang SC": "苹方-简",
      },
    });
    expect(item.label).toBe("文本外观");
    expect(item.children?.map((c) => c.label)).toEqual([
      "字体",
      "字号",
      "加粗",
      "斜体",
    ]);
    expect(item.children?.[2]?.checked).toBe(true);
    expect(item.children?.[3]?.checked).toBe(true);
    const fontMenu = item.children?.[0]?.children ?? [];
    expect(fontMenu.map((entry) => entry.label)).toEqual(["思源宋体-简", "苹方-简"]);
    const fontSizeMenu = item.children?.[1];
    expect(fontSizeMenu?.label).toBe("字号");
    expect(fontSizeMenu?.children?.find((entry) => entry.key === "fontSize:14")?.checked).toBe(true);
    expect(fontSizeMenu?.children?.find((entry) => entry.key === "fontSize:13")?.checked).toBe(false);
  });
});

describe("isSegmentTextContextMenuKey", () => {
  it("recognizes actionable keys", () => {
    expect(isSegmentTextContextMenuKey("toggleBold")).toBe(true);
    expect(isSegmentTextContextMenuKey("fontSize:14")).toBe(true);
    expect(isSegmentTextContextMenuKey("font:Inter")).toBe(true);
    expect(isSegmentTextContextMenuKey("appearance")).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLocalFontLabelIndex,
  buildTranscriptFontOptions,
  CJK_FONT_PROBE,
  fontFamilyNameHintsCjk,
  fontFamilySupportsCjkText,
  pickFontMenuLabelFromMetadata,
  readStoredTranscriptFontFamily,
  readStoredTranscriptFontItalic,
  readStoredTranscriptFontWeight,
  resolveNativeFontDisplayLabel,
  resolveTranscriptFontDisplayLabel,
  transcriptFontFamilyDisplayLabel,
  transcriptFontFamilyCssStack,
  writeStoredTranscriptFontFamily,
  writeStoredTranscriptFontItalic,
  writeStoredTranscriptFontWeight,
} from "./editorTranscriptAppearance";

function mockFonts(checkImpl: (spec: string, text?: string) => boolean) {
  return {
    check: vi.fn((spec: string, text?: string) => checkImpl(spec, text)),
    load: vi.fn(() => Promise.resolve([])),
  };
}

describe("editorTranscriptAppearance localStorage", () => {
  const mem: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const k of Object.keys(mem)) delete mem[k];
      },
      key: () => null,
      length: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(mem)) delete mem[k];
  });

  it("round-trips font family after normalize", () => {
    writeStoredTranscriptFontFamily('"Songti SC"');
    expect(readStoredTranscriptFontFamily()).toBe("Songti SC");
  });

  it("round-trips font weight", () => {
    writeStoredTranscriptFontWeight(700);
    expect(readStoredTranscriptFontWeight()).toBe(700);
    writeStoredTranscriptFontWeight(500);
    expect(readStoredTranscriptFontWeight()).toBe(500);
  });

  it("round-trips font italic", () => {
    writeStoredTranscriptFontItalic(true);
    expect(readStoredTranscriptFontItalic()).toBe(true);
    writeStoredTranscriptFontItalic(false);
    expect(readStoredTranscriptFontItalic()).toBe(false);
  });
});

describe("editorTranscriptAppearance CJK font probe", () => {
  it("uses CJK probe text for font check", () => {
    const fonts = mockFonts((spec, text) => text === CJK_FONT_PROBE && spec.includes("PingFang SC"));
    expect(fontFamilySupportsCjkText("PingFang SC", fonts)).toBe(true);
    expect(fontFamilySupportsCjkText("Arial", fonts)).toBe(false);
    expect(fonts.check).toHaveBeenCalledWith('16px "PingFang SC"', CJK_FONT_PROBE);
  });

  it("hints CJK-capable family names for local font scan", () => {
    expect(fontFamilyNameHintsCjk("PingFang SC")).toBe(true);
    expect(fontFamilyNameHintsCjk("Arial")).toBe(false);
    expect(fontFamilyNameHintsCjk("Menlo")).toBe(false);
  });

  it("builds font options from candidates that pass CJK probe", async () => {
    const latinOnly = new Set(["Arial", "Menlo", "Monaco", "Fira Code", "Inter", "Helvetica Neue"]);
    const fonts = mockFonts((spec, text) => {
      if (text !== CJK_FONT_PROBE) return false;
      return ![...latinOnly].some((family) => spec.includes(`"${family}"`));
    });
    const catalog = await buildTranscriptFontOptions({
      fonts,
      storedFamily: "Songti SC",
    });
    expect(catalog.families).toContain("PingFang SC");
    expect(catalog.families).toContain("Songti SC");
    expect(catalog.families).not.toContain("Arial");
    expect(catalog.families).not.toContain("Menlo");
  });

  it("includes stored family when it passes probe even if not in candidates", async () => {
    const fonts = mockFonts((spec) => spec.includes("LXGW WenKai"));
    const catalog = await buildTranscriptFontOptions({
      fonts,
      storedFamily: "LXGW WenKai",
    });
    expect(catalog.families).toContain("LXGW WenKai");
  });

  it("uses native Chinese labels from queryLocalFonts when available", async () => {
    const latinOnly = new Set(["Arial", "Menlo", "Monaco", "Fira Code", "Inter", "Helvetica Neue"]);
    const fonts = mockFonts((spec, text) => {
      if (text !== CJK_FONT_PROBE) return false;
      return ![...latinOnly].some((family) => spec.includes(`"${family}"`));
    });
    const catalog = await buildTranscriptFontOptions({
      fonts,
      queryLocalFonts: () =>
        Promise.resolve([
          {
            family: "苹方-简",
            fullName: "苹方-简",
            postscriptName: "PingFangSC-Regular",
          },
          {
            family: "Songti SC",
            fullName: "宋体-简",
            postscriptName: "SongtiSC-Regular",
          },
        ]),
    });
    expect(catalog.displayLabels["PingFang SC"]).toBe("苹方-简");
    expect(catalog.displayLabels["Songti SC"]).toBe("宋体-简");
    expect(catalog.families).not.toContain("苹方-简");
  });

  it("builds css stack with quoted family", () => {
    expect(transcriptFontFamilyCssStack("Songti SC")).toContain('"Songti SC"');
    expect(transcriptFontFamilyCssStack("Songti SC")).toContain("PingFang SC");
  });
});

describe("transcriptFontFamilyDisplayLabel", () => {
  it("maps known system fonts to Chinese labels", () => {
    expect(transcriptFontFamilyDisplayLabel("PingFang SC")).toBe("苹方-简");
    expect(transcriptFontFamilyDisplayLabel("Songti SC")).toBe("宋体-简");
    expect(transcriptFontFamilyDisplayLabel("Noto Serif SC")).toBe("思源宋体-简");
    expect(transcriptFontFamilyDisplayLabel("Microsoft YaHei")).toBe("微软雅黑");
    expect(transcriptFontFamilyDisplayLabel("LXGW WenKai")).toBe("霞鹜文楷");
  });

  it("keeps already-Chinese family names", () => {
    expect(transcriptFontFamilyDisplayLabel("华文楷体")).toBe("华文楷体");
  });

  it("derives region suffix labels for common bases", () => {
    expect(transcriptFontFamilyDisplayLabel("Yuanti SC")).toBe("圆体-简");
  });
});

describe("native font display labels", () => {
  it("prefers Chinese family or fullName from font metadata", () => {
    expect(pickFontMenuLabelFromMetadata("PingFang SC", "PingFang SC")).toBeNull();
    expect(pickFontMenuLabelFromMetadata("苹方-简", "PingFang SC")).toBe("苹方-简");
    expect(pickFontMenuLabelFromMetadata("Songti SC", "宋体-简")).toBe("宋体-简");
  });

  it("links English css family keys to native labels via postscript name", () => {
    const index = buildLocalFontLabelIndex([
      { family: "苹方-简", fullName: "苹方-简", postscriptName: "PingFangSC-Regular" },
    ]);
    expect(resolveNativeFontDisplayLabel("PingFang SC", index)).toBe("苹方-简");
  });

  it("resolveTranscriptFontDisplayLabel prefers runtime labels", () => {
    expect(
      resolveTranscriptFontDisplayLabel("PingFang SC", { "PingFang SC": "苹方-简" }),
    ).toBe("苹方-简");
    expect(resolveTranscriptFontDisplayLabel("PingFang SC")).toBe("苹方-简");
  });
});

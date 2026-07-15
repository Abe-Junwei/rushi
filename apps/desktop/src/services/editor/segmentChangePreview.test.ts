import { describe, expect, it } from "vitest";
import { sliceGraphemes } from "../text/grapheme";
import {
  buildTextChangeDisplaySnippets,
  buildTextChangePreviewHighlights,
  DEFAULT_CHANGE_SNIPPET_CONTEXT_CHARS,
  diffToCorrectionHighlights,
  resolveTextChangeRowDisplay,
} from "./segmentChangePreview";

function snippetHighlightText(text: string, startG: number, endG: number): string {
  return sliceGraphemes(text, startG, endG);
}

describe("segmentChangePreview", () => {
  it("centers minimal diff at end of long segment", () => {
    const prefix = "甲".repeat(DEFAULT_CHANGE_SNIPPET_CONTEXT_CHARS + 5);
    const before = `${prefix}制控`;
    const after = `${prefix}自控`;
    const snippets = buildTextChangeDisplaySnippets(before, after);
    expect(snippets).not.toBeNull();
    expect(snippets!.before.displayText).toContain("制");
    expect(snippets!.before.displayText.startsWith("…")).toBe(true);
    expect(snippets!.after.displayText).toContain("自");
    expect(
      snippetHighlightText(
        snippets!.before.displayText,
        snippets!.before.highlightStartG,
        snippets!.before.highlightEndG,
      ),
    ).toBe("制");
  });

  it("highlights replace region in snippet-relative grapheme indices", () => {
    const before = "前言制控后记";
    const after = "前言自控后记";
    const preview = buildTextChangePreviewHighlights(before, after, { contextChars: 2 });
    expect(preview.beforeText).toContain("制");
    expect(
      snippetHighlightText(
        preview.beforeText,
        preview.beforeHighlights[0].startG,
        preview.beforeHighlights[0].endG,
      ),
    ).toBe("制");
    expect(
      snippetHighlightText(
        preview.afterText,
        preview.afterHighlights[0].startG,
        preview.afterHighlights[0].endG,
      ),
    ).toBe("自");
  });

  it("highlights insert side when replace expands to multiple graphemes", () => {
    const before = "开场制讲结束";
    const after = "开场自控讲结束";
    const preview = buildTextChangePreviewHighlights(before, after, { contextChars: 2 });
    expect(
      snippetHighlightText(
        preview.beforeText,
        preview.beforeHighlights[0].startG,
        preview.beforeHighlights[0].endG,
      ),
    ).toBe("制");
    expect(
      snippetHighlightText(
        preview.afterText,
        preview.afterHighlights[0].startG,
        preview.afterHighlights[0].endG,
      ),
    ).toBe("自控");
  });

  it("diffToCorrectionHighlights maps full-text grapheme spans", () => {
    const { beforeHighlights, afterHighlights } = diffToCorrectionHighlights(
      "三千年前",
      "三天年前",
    );
    expect(beforeHighlights).toEqual([{ startG: 1, endG: 2 }]);
    expect(afterHighlights).toEqual([{ startG: 1, endG: 2 }]);
  });

  it("returns null snippets when texts match", () => {
    expect(buildTextChangeDisplaySnippets("相同", "相同")).toBeNull();
  });

  it("resolveTextChangeRowDisplay uses wrap when focused", () => {
    const before = "甲".repeat(40) + "制控";
    const after = "甲".repeat(40) + "自控";
    const unfocused = resolveTextChangeRowDisplay(before, after);
    expect(unfocused.variant).toBe("snippet");
    expect(unfocused.beforeText).toContain("…");

    const focused = resolveTextChangeRowDisplay(before, after, { focused: true });
    expect(focused.variant).toBe("wrap");
    expect(focused.beforeText).toBe(before);
    expect(focused.afterText).toBe(after);
    expect(focused.beforeHighlights).toEqual([{ startG: 40, endG: 41 }]);
  });
});

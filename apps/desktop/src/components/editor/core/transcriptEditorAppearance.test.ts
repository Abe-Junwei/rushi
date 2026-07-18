// @vitest-environment jsdom

import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { TRANSCRIPT_FONT_DEFAULT } from "../../../utils/waveformPrefs";
import {
  TRANSCRIPT_EDITOR_LINE_PADDING_LEFT,
  TRANSCRIPT_EDITOR_META_CONTENT_GAP,
  TRANSCRIPT_EDITOR_MIN_LINE_PX,
  transcriptEditorRowMetrics,
} from "../../../utils/segmentLayout";
import { buildTranscriptEditorState } from "./buildTranscriptEditorState";
import { buildTranscriptEditorCoreExtensions } from "./transcriptEditorCoreMount";
import { TRANSCRIPT_META_WIDTH_DEFAULT } from "../editorTranscriptFontCatalogCore";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 1,
    text: `语段${i}`,
    kind: "speech" as const,
  }));
}

describe("transcript editor appearance theme", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
  });

  it("applies configured row min-height and left-column/text gap in the live CM theme", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const appearanceCompartment = new Compartment();
    const fontPx = TRANSCRIPT_FONT_DEFAULT;
    const row = transcriptEditorRowMetrics(fontPx);
    const extensions = buildTranscriptEditorCoreExtensions({
      fontPx,
      fontFamily: "PingFang SC",
      fontWeight: 500,
      fontItalic: false,
      metaGutterWidthPx: TRANSCRIPT_META_WIDTH_DEFAULT,
      appearanceCompartment,
      latestSegmentsRef: { current: makeSegments(2) },
      applyingFromBridgeRef: { current: false },
      updateSegmentTextRef: { current: () => {} },
      onSelectSegmentRef: { current: () => {} },
      onToggleSegmentPlayRef: { current: () => {} },
      onToggleSegmentLoopRef: { current: () => {} },
      onOpenSegmentAnnotationDialogRef: { current: () => {} },
      busyRef: { current: false },
      onOpenContextMenuRef: { current: () => {} },
      rowHeightDragFromDomRef: { current: undefined },
    });
    const state = buildTranscriptEditorState(makeSegments(2), { extensions });
    view = new EditorView({ state, parent });

    const line = view.contentDOM.querySelector(".cm-line");
    expect(line).toBeTruthy();
    // jsdom does not resolve `var()` in getComputedStyle reliably, so assert on
    // the raw CSS CodeMirror actually injected instead (this is what a real
    // browser will resolve at paint time).
    const injectedCss = Array.from(document.querySelectorAll("style"))
      .map((el) => el.textContent ?? "")
      .join("\n");
    expect(injectedCss).toContain(`min-height: ${TRANSCRIPT_EDITOR_MIN_LINE_PX}px`);
    expect(injectedCss).toContain(`padding-top: ${row.linePadPx}px`);
    // paddingLeft reserves play control + symmetric gaps before segment text.
    expect(injectedCss).toContain(`padding-left: ${TRANSCRIPT_EDITOR_LINE_PADDING_LEFT}`);
    expect(injectedCss).toContain(
      `--cm-transcript-meta-content-gap: ${TRANSCRIPT_EDITOR_META_CONTENT_GAP}`,
    );
    expect(injectedCss).toContain(`--cm-transcript-min-line-px: ${TRANSCRIPT_EDITOR_MIN_LINE_PX}px`);

    expect(TRANSCRIPT_EDITOR_META_CONTENT_GAP).toBe("0.4rem");
    expect(TRANSCRIPT_EDITOR_MIN_LINE_PX).toBe(75);
  });
});

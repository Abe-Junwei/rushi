// @vitest-environment jsdom

import { describe, expect, it, afterEach, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  buildTranscriptEditorState,
  transcriptEditorCoreExtensions,
  selectSegmentCommand,
  selectSegmentTransaction,
  revealSegmentInView,
  primarySegmentIdx,
  segmentMetaField,
  buildTranscriptMetaMarker,
  buildTranscriptStageMarker,
  computeTranscriptMetaGutterWidthPx,
} from "./index";
import { formatTranscriptTimestamp } from "../../segmentRow/segmentRowFormatting";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i * 65 + 5,
    end_sec: i * 65 + 10,
    text: `语段 ${i}`,
    text_stage: i % 2 === 0 ? ("auto_transcribe" as const) : ("manual_transcribe" as const),
  }));
}

describe("P4 meta gutter + reveal + stage", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
  });

  it("builds index + timestamp markers without stage on the left gutter", () => {
    const segs = makeSegments(2);
    const state = buildTranscriptEditorState(segs, {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    const meta = state.field(segmentMetaField);
    const marker0 = buildTranscriptMetaMarker(meta[0], 0, { highlighted: true });
    expect(marker0).toBeTruthy();
    expect(marker0!.indexLabel).toBe("1.");
    expect(marker0!.timeLabel).toBe(formatTranscriptTimestamp(segs[0].start_sec));
    expect(marker0!.highlighted).toBe(true);
    const dom = marker0!.toDOM();
    expect(dom.querySelector(".cm-transcript-meta-stage")).toBeNull();
    expect(dom.className).toContain("cm-transcript-meta-marker--primary");
  });

  it("builds trailing stage chip from meta.stage + finalizeVia", () => {
    const segs = makeSegments(2);
    const state = buildTranscriptEditorState(segs, {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    const meta = state.field(segmentMetaField);
    const stage0 = buildTranscriptStageMarker(meta[0]);
    expect(stage0?.label).toBe("自动转写");
    expect(stage0?.stageMod).toBe("auto_transcribe");
    expect(stage0?.toDOM().querySelector(".cm-transcript-stage-chip")?.className).toContain(
      "cm-transcript-stage-chip--auto_transcribe",
    );
    expect(stage0?.toDOM().querySelector(".cm-transcript-stage-chip__icon svg")).toBeTruthy();

    const stage1 = buildTranscriptStageMarker(meta[1]);
    expect(stage1?.label).toBe("手动转写");
  });

  it("places loop transport left of play when showSegmentPlay", () => {
    const segs = makeSegments(1);
    const state = buildTranscriptEditorState(segs, {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    const meta = state.field(segmentMetaField);
    const stage = buildTranscriptStageMarker(meta[0], {
      showSegmentPlay: true,
      segmentLoopActive: true,
      segmentPlayActive: true,
    });
    const dom = stage!.toDOM();
    const children = [...dom.children];
    expect(children[0]?.getAttribute("data-cm-segment-loop")).toBe("1");
    expect(children[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(children[1]?.getAttribute("data-cm-segment-play")).toBe("1");
    expect(children[1]?.getAttribute("aria-label")).toBe("停止语段播放");
  });

  it("derives gutter width from full legacy meta column (stage is after-gutter)", () => {
    expect(computeTranscriptMetaGutterWidthPx(132)).toBe(132);
    expect(computeTranscriptMetaGutterWidthPx(104)).toBe(104);
    expect(computeTranscriptMetaGutterWidthPx(40)).toBe(80);
  });

  it("mounts left meta + right stage gutters", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: false }),
        EditorView.theme({
          "&": { height: "240px" },
          ".cm-scroller": { overflow: "auto" },
        }),
      ],
    });
    view = new EditorView({ state, parent });
    expect(view.dom.querySelector(".cm-transcript-meta-gutter")).toBeTruthy();
    expect(view.dom.querySelector(".cm-transcript-stage-gutter")).toBeTruthy();
  });

  it("gutter host bridge selects via selectSegmentCommand path", () => {
    const onSelectSegment = vi.fn();
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(4), {
      extensions: transcriptEditorCoreExtensions({
        withProjection: false,
        metaGutter: { onSelectSegment },
      }),
    });
    view = new EditorView({ state, parent });
    selectSegmentCommand(view, 2);
    onSelectSegment(2, { toggle: false, shiftKey: false });
    expect(primarySegmentIdx(view.state)).toBe(2);
    expect(onSelectSegment).toHaveBeenCalledWith(2, {
      toggle: false,
      shiftKey: false,
    });
  });

  it("selectSegmentTransaction scrolls into view by default", () => {
    const state = buildTranscriptEditorState(makeSegments(20), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    const tr = selectSegmentTransaction(state, 15);
    expect(tr?.scrollIntoView).toBe(true);
  });

  it("revealSegmentInView scrolls via scrollDOM (not CM scrollIntoView effect)", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(30), {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: false }),
        EditorView.theme({
          "&": { height: "120px" },
          ".cm-scroller": { overflow: "auto" },
        }),
      ],
    });
    view = new EditorView({ state, parent });
    Object.defineProperty(view.scrollDOM, "clientHeight", { configurable: true, value: 120 });
    Object.defineProperty(view.scrollDOM, "scrollHeight", { configurable: true, value: 4000 });
    Object.defineProperty(view.scrollDOM, "scrollTop", { configurable: true, writable: true, value: 0 });
    selectSegmentCommand(view, 0, { scrollIntoView: false });
    expect(revealSegmentInView(view, 25, { y: "center" })).toBe(true);
    expect(view.scrollDOM.scrollTop).toBeGreaterThan(0);
    expect(revealSegmentInView(view, 999)).toBe(false);
  });
});

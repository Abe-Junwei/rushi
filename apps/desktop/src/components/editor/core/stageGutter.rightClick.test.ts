// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { TransactionSpec } from "@codemirror/state";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { buildTranscriptEditorState, transcriptEditorCoreExtensions, primarySegmentIdx } from "./index";
import {
  CM_SEGMENT_IDX_ATTR,
  handleTranscriptStageGutterMousedown,
  resolveTranscriptStageGutterSegmentIdx,
} from "./stageGutter";
import { setTranscriptFilterVisibleEffect } from "./filterLineVisibility";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i * 65 + 5,
    end_sec: i * 65 + 10,
    text: `语段 ${i}`,
    text_stage: "auto_transcribe" as const,
  }));
}

function makeMouseEvent(button: number, target: HTMLElement | null = null): MouseEvent {
  return {
    button,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    target,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as MouseEvent;
}

describe("stage gutter mousedown → onSelectSegment bridge", () => {
  it("right-click on a non-primary row moves CM primary but does not bridge to list select", () => {
    const onSelectSegment = vi.fn();
    let state = buildTranscriptEditorState(makeSegments(4), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    const view = {
      get state() {
        return state;
      },
      dispatch: (tr: TransactionSpec) => {
        state = state.update(tr).state;
      },
    };
    expect(primarySegmentIdx(state)).toBe(0);

    const lineFrom = state.doc.line(3).from; // idx 2
    const handled = handleTranscriptStageGutterMousedown(view, lineFrom, makeMouseEvent(2), {
      onSelectSegment,
    });

    expect(handled).toBe(true);
    // CM6-local selection still moves (context menu should target the clicked row)...
    expect(primarySegmentIdx(state)).toBe(2);
    // ...but must not go through the "list" select bridge (would seek/reveal/
    // possibly arm global playback). `contextmenu` owns the React-side re-select.
    expect(onSelectSegment).not.toHaveBeenCalled();
  });

  it("left-click still bridges to onSelectSegment (list source)", () => {
    const onSelectSegment = vi.fn();
    let state = buildTranscriptEditorState(makeSegments(4), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    const view = {
      get state() {
        return state;
      },
      dispatch: (tr: TransactionSpec) => {
        state = state.update(tr).state;
      },
    };

    const lineFrom = state.doc.line(2).from; // idx 1
    handleTranscriptStageGutterMousedown(view, lineFrom, makeMouseEvent(0), {
      onSelectSegment,
    });

    expect(primarySegmentIdx(state)).toBe(1);
    expect(onSelectSegment).toHaveBeenCalledWith(1, { toggle: false, shiftKey: false });
  });

  it("click on annotation icon opens the annotation dialog for that segment", () => {
    const onOpenSegmentAnnotationDialog = vi.fn();
    const onSelectSegment = vi.fn();
    let state = buildTranscriptEditorState(makeSegments(4), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    const view = {
      get state() {
        return state;
      },
      dispatch: (tr: TransactionSpec) => {
        state = state.update(tr).state;
      },
    };

    const annotationIcon = document.createElement("button");
    annotationIcon.type = "button";
    annotationIcon.setAttribute("data-cm-segment-annotation", "1");
    annotationIcon.setAttribute(CM_SEGMENT_IDX_ATTR, "2");
    const lineFrom = state.doc.line(3).from; // idx 2
    const handled = handleTranscriptStageGutterMousedown(
      view,
      lineFrom,
      makeMouseEvent(0, annotationIcon),
      { onSelectSegment, onOpenSegmentAnnotationDialog },
    );

    expect(handled).toBe(true);
    expect(onOpenSegmentAnnotationDialog).toHaveBeenCalledWith(2);
    expect(onSelectSegment).not.toHaveBeenCalled();
    expect(primarySegmentIdx(state)).toBe(0);
  });

  it("annotation click uses stamped idx when CM6 lineFrom lands on preceding filter-collapsed run", () => {
    // Frozen run 0..2 hidden; visible 3 has the note. CM6 often reports lineFrom of idx 0.
    const segs = makeSegments(4).map((s, i) => ({
      ...s,
      frozen: i < 3,
      annotation: i === 3 ? "可见备注" : null,
    }));
    let state = buildTranscriptEditorState(segs, {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    state = state.update({
      effects: setTranscriptFilterVisibleEffect.of(new Set([3])),
    }).state;

    const collapsedFirstFrom = state.doc.line(1).from; // idx 0 — first of frozen run
    const annotationIcon = document.createElement("button");
    annotationIcon.type = "button";
    annotationIcon.setAttribute("data-cm-segment-annotation", "1");
    annotationIcon.setAttribute(CM_SEGMENT_IDX_ATTR, "3");

    expect(
      resolveTranscriptStageGutterSegmentIdx(
        state,
        collapsedFirstFrom,
        makeMouseEvent(0, annotationIcon),
      ),
    ).toBe(3);

    const onOpenSegmentAnnotationDialog = vi.fn();
    const view = {
      get state() {
        return state;
      },
      dispatch: (tr: TransactionSpec) => {
        state = state.update(tr).state;
      },
    };
    handleTranscriptStageGutterMousedown(
      view,
      collapsedFirstFrom,
      makeMouseEvent(0, annotationIcon),
      { onOpenSegmentAnnotationDialog },
    );
    expect(onOpenSegmentAnnotationDialog).toHaveBeenCalledWith(3);
  });

  it("coerces filter-hidden lineFrom to the next visible segment when stamp is absent", () => {
    const segs = makeSegments(5).map((s, i) => ({ ...s, frozen: i < 3 }));
    let state = buildTranscriptEditorState(segs, {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    state = state.update({
      effects: setTranscriptFilterVisibleEffect.of(new Set([3, 4])),
    }).state;

    const collapsedFirstFrom = state.doc.line(1).from; // idx 0
    expect(
      resolveTranscriptStageGutterSegmentIdx(
        state,
        collapsedFirstFrom,
        makeMouseEvent(0, document.createElement("div")),
      ),
    ).toBe(3);
  });

  it("right-click on annotation icon falls through to context-menu selection, not dialog", () => {
    const onOpenSegmentAnnotationDialog = vi.fn();
    const onSelectSegment = vi.fn();
    let state = buildTranscriptEditorState(makeSegments(4), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    const view = {
      get state() {
        return state;
      },
      dispatch: (tr: TransactionSpec) => {
        state = state.update(tr).state;
      },
    };

    const annotationIcon = document.createElement("button");
    annotationIcon.type = "button";
    annotationIcon.setAttribute("data-cm-segment-annotation", "1");
    const lineFrom = state.doc.line(3).from; // idx 2
    const handled = handleTranscriptStageGutterMousedown(
      view,
      lineFrom,
      makeMouseEvent(2, annotationIcon),
      { onSelectSegment, onOpenSegmentAnnotationDialog },
    );

    expect(handled).toBe(true);
    expect(onOpenSegmentAnnotationDialog).not.toHaveBeenCalled();
    expect(primarySegmentIdx(state)).toBe(2);
  });

  it("does not open annotation dialog when busy", () => {
    const onOpenSegmentAnnotationDialog = vi.fn();
    const annotationIcon = document.createElement("button");
    annotationIcon.type = "button";
    annotationIcon.setAttribute("data-cm-segment-annotation", "1");
    let state = buildTranscriptEditorState(makeSegments(2), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    const view = {
      get state() {
        return state;
      },
      dispatch: (tr: TransactionSpec) => {
        state = state.update(tr).state;
      },
    };
    const lineFrom = state.doc.line(2).from;
    handleTranscriptStageGutterMousedown(view, lineFrom, makeMouseEvent(0, annotationIcon), {
      onOpenSegmentAnnotationDialog,
      isBusy: () => true,
    });
    expect(onOpenSegmentAnnotationDialog).not.toHaveBeenCalled();
  });
});

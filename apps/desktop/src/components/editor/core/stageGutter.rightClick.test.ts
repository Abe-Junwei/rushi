// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { TransactionSpec } from "@codemirror/state";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { buildTranscriptEditorState, transcriptEditorCoreExtensions, primarySegmentIdx } from "./index";
import { handleTranscriptStageGutterMousedown } from "./stageGutter";

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

function makeMouseEvent(button: number): MouseEvent {
  return {
    button,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    target: null,
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
});

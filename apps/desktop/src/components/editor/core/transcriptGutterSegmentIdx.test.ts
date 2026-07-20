// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { buildTranscriptEditorState, transcriptEditorCoreExtensions } from "./index";
import { setTranscriptFilterVisibleEffect } from "./filterLineVisibility";
import {
  CM_SEGMENT_IDX_ATTR,
  resolveTranscriptGutterSegmentIdx,
} from "./transcriptGutterSegmentIdx";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 0.5,
    text: `语段 ${i}`,
    text_stage: "auto_transcribe" as const,
    frozen: i < 3,
  }));
}

function mouse(target: HTMLElement | null): MouseEvent {
  return {
    button: 0,
    target,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as MouseEvent;
}

describe("resolveTranscriptGutterSegmentIdx", () => {
  it("prefers stamped idx over filter-collapsed lineFrom", () => {
    let state = buildTranscriptEditorState(makeSegments(5), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    state = state.update({
      effects: setTranscriptFilterVisibleEffect.of(new Set([3, 4])),
    }).state;

    const el = document.createElement("div");
    el.setAttribute(CM_SEGMENT_IDX_ATTR, "4");
    expect(
      resolveTranscriptGutterSegmentIdx(state, state.doc.line(1).from, mouse(el)),
    ).toBe(4);
  });

  it("coerces hidden lineFrom to next visible when stamp is absent", () => {
    let state = buildTranscriptEditorState(makeSegments(5), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    state = state.update({
      effects: setTranscriptFilterVisibleEffect.of(new Set([3, 4])),
    }).state;

    expect(
      resolveTranscriptGutterSegmentIdx(
        state,
        state.doc.line(1).from,
        mouse(document.createElement("div")),
      ),
    ).toBe(3);
  });
});

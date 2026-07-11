// @vitest-environment jsdom

import { describe, expect, it, afterEach } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { buildTranscriptEditorState } from "./buildTranscriptEditorState";
import { transcriptEditorCoreExtensions } from "./transcriptEditorCoreExtensions";
import {
  setTranscriptHoverSegmentEffect,
  transcriptHoverSegmentField,
} from "./hoverSegmentField";

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

describe("hoverSegmentField", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
  });

  it("applies hover line class and clears on null", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(1) });
    expect(view.state.field(transcriptHoverSegmentField)).toBe(1);
    expect(view.contentDOM.querySelector(".cm-transcript-hover-line")).toBeTruthy();
    view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(null) });
    expect(view.state.field(transcriptHoverSegmentField)).toBeNull();
    expect(view.contentDOM.querySelector(".cm-transcript-hover-line")).toBeNull();
  });
});

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { buildTranscriptEditorState } from "./buildTranscriptEditorState";
import { transcriptEditorCoreExtensions } from "./transcriptEditorCoreExtensions";
import {
  setTranscriptPlaybackFocusEffect,
  transcriptPlaybackFocusField,
} from "./playbackFocusField";

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

describe("playbackFocusField", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
  });

  it("applies playback-focus line class and clears on null", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    view.dispatch({ effects: setTranscriptPlaybackFocusEffect.of(1) });
    expect(view.state.field(transcriptPlaybackFocusField)).toBe(1);
    expect(view.contentDOM.querySelector(".cm-transcript-playback-focus")).toBeTruthy();

    view.dispatch({ effects: setTranscriptPlaybackFocusEffect.of(null) });
    expect(view.state.field(transcriptPlaybackFocusField)).toBeNull();
    expect(view.contentDOM.querySelector(".cm-transcript-playback-focus")).toBeNull();
  });
});

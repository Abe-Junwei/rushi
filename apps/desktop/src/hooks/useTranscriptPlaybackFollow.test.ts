// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EditorView } from "@codemirror/view";
import { useTranscriptPlaybackFollow } from "./useTranscriptPlaybackFollow";
import { buildTranscriptEditorState } from "../components/editor/core/buildTranscriptEditorState";
import { transcriptEditorCoreExtensions } from "../components/editor/core/transcriptEditorCoreExtensions";
import { transcriptPlaybackFocusField } from "../components/editor/core/playbackFocusField";
import { registerTranscriptEditorView } from "../components/editor/core/transcriptEditorViewHandle";
import type { SegmentDto } from "../tauri/projectApi";
import { writeStoredTranscriptPlaybackFollow } from "../utils/waveformPrefs";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i * 10,
    end_sec: i * 10 + 10,
    text: `s${i}`,
    kind: "speech" as const,
  }));
}

describe("useTranscriptPlaybackFollow", () => {
  let view: EditorView | null = null;
  let frameCb: ((t: number) => void) | null = null;

  afterEach(() => {
    registerTranscriptEditorView(null);
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
    frameCb = null;
    writeStoredTranscriptPlaybackFollow(true);
  });

  it("updates CM6 playback focus as playhead advances", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(4), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    registerTranscriptEditorView(view);

    const subscribePlayheadFrame = (cb: (t: number) => void) => {
      frameCb = cb;
      return () => {
        frameCb = null;
      };
    };

    renderHook(() =>
      useTranscriptPlaybackFollow({
        isPlaying: true,
        isReady: true,
        segments: makeSegments(4),
        selectedIdx: 0,
        subscribePlayheadFrame,
      }),
    );

    act(() => {
      frameCb?.(5.1);
    });
    expect(view.state.field(transcriptPlaybackFocusField)).toBe(0);

    act(() => {
      frameCb?.(15.1);
    });
    expect(view.state.field(transcriptPlaybackFocusField)).toBe(1);
    expect(view.contentDOM.querySelector(".cm-transcript-playback-focus")).toBeTruthy();
  });

  it("clears focus when paused", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(2), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    registerTranscriptEditorView(view);

    const subscribePlayheadFrame = (cb: (t: number) => void) => {
      frameCb = cb;
      return () => {
        frameCb = null;
      };
    };

    const { rerender } = renderHook(
      ({ playing }: { playing: boolean }) =>
        useTranscriptPlaybackFollow({
          isPlaying: playing,
          isReady: true,
          segments: makeSegments(2),
          selectedIdx: 0,
          subscribePlayheadFrame,
        }),
      { initialProps: { playing: true } },
    );

    act(() => {
      frameCb?.(5.1);
    });
    expect(view.state.field(transcriptPlaybackFocusField)).toBe(0);

    rerender({ playing: false });
    expect(view.state.field(transcriptPlaybackFocusField)).toBeNull();
  });

  it("does not repaint stale playback focus while a selected seek is catching up", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const segments = makeSegments(4);
    const state = buildTranscriptEditorState(segments, {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    registerTranscriptEditorView(view);

    const subscribePlayheadFrame = (cb: (t: number) => void) => {
      frameCb = cb;
      return () => {
        frameCb = null;
      };
    };

    const { result } = renderHook(() =>
      useTranscriptPlaybackFollow({
        isPlaying: true,
        isReady: true,
        segments,
        selectedIdx: 0,
        subscribePlayheadFrame,
      }),
    );

    act(() => {
      frameCb?.(5.1);
    });
    expect(view.state.field(transcriptPlaybackFocusField)).toBe(0);

    act(() => {
      result.current.notifyUserSegmentSelect(2);
    });
    expect(view.state.field(transcriptPlaybackFocusField)).toBeNull();

    act(() => {
      frameCb?.(5.2);
    });
    expect(view.state.field(transcriptPlaybackFocusField)).toBeNull();

    act(() => {
      frameCb?.(25.1);
    });
    expect(view.state.field(transcriptPlaybackFocusField)).toBe(2);
  });

  it("releases selection divert if playback skips past the selected segment", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const segments = makeSegments(4);
    const state = buildTranscriptEditorState(segments, {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    registerTranscriptEditorView(view);

    const subscribePlayheadFrame = (cb: (t: number) => void) => {
      frameCb = cb;
      return () => {
        frameCb = null;
      };
    };

    const { result } = renderHook(() =>
      useTranscriptPlaybackFollow({
        isPlaying: true,
        isReady: true,
        segments,
        selectedIdx: 0,
        subscribePlayheadFrame,
      }),
    );

    act(() => {
      frameCb?.(5.1);
    });
    act(() => {
      result.current.notifyUserSegmentSelect(2);
    });
    act(() => {
      frameCb?.(35.1);
    });

    expect(view.state.field(transcriptPlaybackFocusField)).toBe(3);
  });

  it("retargets pending selection divert during rapid keyboard selection", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const segments = makeSegments(4);
    const state = buildTranscriptEditorState(segments, {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    registerTranscriptEditorView(view);

    const subscribePlayheadFrame = (cb: (t: number) => void) => {
      frameCb = cb;
      return () => {
        frameCb = null;
      };
    };

    const { result } = renderHook(() =>
      useTranscriptPlaybackFollow({
        isPlaying: true,
        isReady: true,
        segments,
        selectedIdx: 0,
        subscribePlayheadFrame,
      }),
    );

    act(() => {
      frameCb?.(5.1);
    });
    act(() => {
      result.current.notifyUserSegmentSelect(2);
      result.current.notifyUserSegmentSelect(3);
    });
    act(() => {
      frameCb?.(25.1);
    });
    expect(view.state.field(transcriptPlaybackFocusField)).toBeNull();

    act(() => {
      frameCb?.(35.1);
    });
    expect(view.state.field(transcriptPlaybackFocusField)).toBe(3);
  });
});

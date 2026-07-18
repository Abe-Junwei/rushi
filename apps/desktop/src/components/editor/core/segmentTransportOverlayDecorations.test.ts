// @vitest-environment jsdom

import { describe, expect, it, afterEach, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { buildTranscriptEditorState } from "./buildTranscriptEditorState";
import { transcriptEditorCoreExtensions } from "./transcriptEditorCoreExtensions";
import { setTranscriptHoverSegmentEffect } from "./hoverSegmentField";
import { selectSegmentCommand } from "./selectionCommands";
import { setTranscriptScopedPlayingEffect } from "./scopedPlayingField";
import {
  CM_SEGMENT_PLAY_ATTR,
  resolvePlayButtonIdxAtPoint,
} from "./segmentTransportOverlayDecorations";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 1,
    text: `语段${i}`,
    kind: "speech" as const,
    text_stage: "auto_transcribe" as const,
  }));
}

describe("segmentTransportOverlayDecorations", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
  });

  it("always mounts play controls and force-reveals the hovered row", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const handlersRef = {
      current: {
        onToggleSegmentPlay: vi.fn(),
      },
    };
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: transcriptEditorCoreExtensions({
        withProjection: false,
        segmentTransportHandlersRef: handlersRef,
      }),
    });
    view = new EditorView({ state, parent });

    expect(view.contentDOM.querySelectorAll(`[${CM_SEGMENT_PLAY_ATTR}]`)).toHaveLength(3);

    view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(1) });
    const host = view.contentDOM.querySelector(".cm-transcript-line-play-host--forced");
    expect(host).toBeTruthy();
    const play = host?.querySelector(`[${CM_SEGMENT_PLAY_ATTR}]`);
    expect(play?.getAttribute("aria-label")).toBe("播本语段（至段尾）");

    play?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(handlersRef.current.onToggleSegmentPlay).toHaveBeenCalledWith(1);
  });

  it("hit-tests the visible play control even when the event target is the gutter", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const handlersRef = {
      current: {
        onToggleSegmentPlay: vi.fn(),
      },
    };
    const state = buildTranscriptEditorState(makeSegments(2), {
      extensions: transcriptEditorCoreExtensions({
        withProjection: false,
        segmentTransportHandlersRef: handlersRef,
      }),
    });
    view = new EditorView({ state, parent });
    view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(0) });
    const play = view.contentDOM.querySelector(
      `.cm-transcript-line-play-host--forced [${CM_SEGMENT_PLAY_ATTR}]`,
    );
    expect(play).toBeTruthy();
    Object.defineProperty(play, "getBoundingClientRect", {
      value: () =>
        ({
          left: 10,
          top: 20,
          right: 34,
          bottom: 44,
          width: 24,
          height: 24,
          x: 10,
          y: 20,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      if (el === play) {
        return { opacity: "0.94" } as CSSStyleDeclaration;
      }
      return {
        opacity: "1",
      } as CSSStyleDeclaration;
    });

    expect(resolvePlayButtonIdxAtPoint(view.contentDOM, 20, 30)).toBe(0);
    expect(resolvePlayButtonIdxAtPoint(view.contentDOM, 200, 300)).toBeNull();

    view.dom.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 30,
        button: 0,
      }),
    );
    expect(handlersRef.current.onToggleSegmentPlay).toHaveBeenCalledWith(0);
    vi.restoreAllMocks();
  });

  it("marks the primary play control active while scoped playing", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const handlersRef = { current: {} };
    const state = buildTranscriptEditorState(makeSegments(2), {
      extensions: transcriptEditorCoreExtensions({
        withProjection: false,
        segmentTransportHandlersRef: handlersRef,
      }),
    });
    view = new EditorView({ state, parent });
    selectSegmentCommand(view, 0, { scrollIntoView: false });
    view.dispatch({ effects: setTranscriptScopedPlayingEffect.of(true) });

    const active = view.contentDOM.querySelector(".cm-transcript-segment-play--active");
    expect(active).toBeTruthy();
    expect(active?.getAttribute("aria-label")).toBe("暂停语段播放");
  });
});

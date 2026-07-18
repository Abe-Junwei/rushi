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
import { selectSegmentCommand } from "./selectionCommands";
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

describe("hoverSegmentField", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
  });

  it("paints hover wash on non-selected rows", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    selectSegmentCommand(view, 0, { scrollIntoView: false });
    view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(1) });
    expect(view.state.field(transcriptHoverSegmentField)).toBe(1);
    expect(view.contentDOM.querySelector(".cm-transcript-hover-line")).toBeTruthy();
    view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(null) });
    expect(view.state.field(transcriptHoverSegmentField)).toBeNull();
    expect(view.contentDOM.querySelector(".cm-transcript-hover-line")).toBeNull();
  });

  it("skips hover wash on the primary selected row", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    selectSegmentCommand(view, 1, { scrollIntoView: false });
    view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(1) });
    expect(view.state.field(transcriptHoverSegmentField)).toBe(1);
    expect(view.contentDOM.querySelector(".cm-transcript-hover-line")).toBeNull();
    expect(view.contentDOM.querySelector(".cm-transcript-primary-line")).toBeTruthy();
  });

  it("clears hover in the same select transaction", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    selectSegmentCommand(view, 0, { scrollIntoView: false });
    view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(2) });
    expect(view.state.field(transcriptHoverSegmentField)).toBe(2);
    expect(view.contentDOM.querySelector(".cm-transcript-hover-line")).toBeTruthy();
    selectSegmentCommand(view, 1);
    expect(view.state.field(transcriptHoverSegmentField)).toBeNull();
    expect(view.contentDOM.querySelector(".cm-transcript-hover-line")).toBeNull();
  });

  it("clears playback-focus wash in the same ↑↓ / select transaction", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    view.dispatch({ effects: setTranscriptPlaybackFocusEffect.of(0) });
    expect(view.state.field(transcriptPlaybackFocusField)).toBe(0);
    expect(view.contentDOM.querySelector(".cm-transcript-playback-focus")).toBeTruthy();
    selectSegmentCommand(view, 1, { scrollIntoView: false });
    expect(view.state.field(transcriptPlaybackFocusField)).toBeNull();
    expect(view.contentDOM.querySelector(".cm-transcript-playback-focus")).toBeNull();
    expect(view.contentDOM.querySelector(".cm-transcript-primary-line")).toBeTruthy();
  });

  it("shows row height resize hit zone on hovered line", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const dragRef = {
      current: undefined as ((target: HTMLElement, event: PointerEvent) => void) | undefined,
    };
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: transcriptEditorCoreExtensions({
        withProjection: false,
        rowHeightDragFromDomRef: dragRef,
      }),
    });
    view = new EditorView({ state, parent });
    view.dispatch({ effects: setTranscriptHoverSegmentEffect.of(1) });
    const hit = view.dom.querySelector(".cm-transcript-row-height-resize");
    expect(hit).toBeTruthy();
    expect(hit?.querySelector("[class*='__tri']")).toBeNull();
  });

  it("keeps hover when the pointer moves from content into the left meta gutter", () => {
    const parent = document.createElement("div");
    parent.style.height = "320px";
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: false, withMetaGutter: true }),
        EditorView.theme({
          "&": { height: "320px" },
          ".cm-scroller": { overflow: "auto", height: "100%" },
        }),
      ],
    });
    view = new EditorView({ state, parent });

    const lineEl = view.contentDOM.querySelector(".cm-line");
    expect(lineEl).toBeTruthy();
    lineEl!.dispatchEvent(
      new MouseEvent("mousemove", { bubbles: true, clientX: 80, clientY: 40 }),
    );
    // contentDOM-only handlers would mouseleave-clear here; view.dom listeners must keep it.
    view.contentDOM.dispatchEvent(
      new MouseEvent("mouseleave", {
        bubbles: true,
        clientX: 10,
        clientY: 40,
        relatedTarget: view.dom.querySelector(".cm-gutters"),
      }),
    );
    const gutter = view.dom.querySelector(".cm-gutters") ?? view.dom.querySelector(".cm-gutterElement");
    expect(gutter).toBeTruthy();
    const block = view.lineBlockAt(view.state.doc.line(1).from);
    const clientY = view.documentTop + block.top + 4;
    gutter!.dispatchEvent(
      new MouseEvent("mousemove", { bubbles: true, clientX: 12, clientY }),
    );
    expect(view.state.field(transcriptHoverSegmentField)).toBe(0);
  });
});

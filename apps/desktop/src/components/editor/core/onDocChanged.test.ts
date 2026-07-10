// @vitest-environment jsdom

import { describe, expect, it, afterEach, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  buildTranscriptEditorState,
  transcriptEditorCoreExtensions,
  transcriptLineCountGuard,
  transcriptEditorKeymap,
  createOnDocChangedBridge,
  applyProjectedTextDiff,
  selectSegmentCommand,
  serializeTranscriptEditorState,
  runTranscriptArrowMove,
  primarySegmentIdx,
  getTranscriptMultiSelection,
} from "./index";
import { isTranscriptEditorCoreTarget } from "./transcriptEditorDom";
import { TRANSCRIPT_EDITOR_CORE_ATTR } from "./transcriptEditorDom";
import { matchEditorShortcut } from "../../../utils/editorShortcutRegistry";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 0.5,
    text: `语段 ${i}`,
  }));
}

describe("P3 onDocChanged + line count guard", () => {
  let root: HTMLDivElement | null = null;
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    root?.remove();
    view = null;
    root = null;
  });

  it("rejects Enter newline (line count stays equal to segments)", () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: false }),
        transcriptLineCountGuard,
        transcriptEditorKeymap,
      ],
    });
    view = new EditorView({ state, parent: root });
    const before = view.state.doc.lines;
    // Simulate Enter inserting a newline at caret.
    const pos = view.state.selection.main.head;
    view.dispatch({
      changes: { from: pos, insert: "\n" },
    });
    expect(view.state.doc.lines).toBe(before);
  });

  it("debounced projection calls updateSegmentText for changed lines only", async () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    const projected: SegmentDto[][] = [];
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: false }),
        transcriptLineCountGuard,
        createOnDocChangedBridge({
          debounceMs: 10,
          onTextLinesProjected: (segs) => projected.push(segs),
        }),
      ],
    });
    view = new EditorView({ state, parent: root });
    const line = view.state.doc.line(2);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: "改写" },
    });
    expect(projected).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 30));
    expect(projected).toHaveLength(1);
    expect(projected[0]![1]!.text).toBe("改写");

    const updateSegmentText = vi.fn();
    const changed = applyProjectedTextDiff({
      baseline: makeSegments(3),
      projected: projected[0]!,
      updateSegmentText,
    });
    expect(changed).toBe(1);
    expect(updateSegmentText).toHaveBeenCalledWith(1, "改写");
  });

  it("marks CM6 core as transcript edit target so Space is not play", () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    const state = buildTranscriptEditorState(makeSegments(2), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent: root });
    view.dom.setAttribute(TRANSCRIPT_EDITOR_CORE_ATTR, "1");
    expect(isTranscriptEditorCoreTarget(view.contentDOM)).toBe(true);
    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true });
    Object.defineProperty(space, "target", { value: view.contentDOM });
    expect(
      matchEditorShortcut(space as unknown as KeyboardEvent, { inTextarea: true }),
    ).toBeNull();
  });

  it("keeps caret path: select + type does not drop primary", () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    const state = buildTranscriptEditorState(makeSegments(4), {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: true }),
        transcriptLineCountGuard,
      ],
    });
    view = new EditorView({ state, parent: root });
    selectSegmentCommand(view, 2);
    view.focus();
    const line = view.state.doc.line(3);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: "仍在编辑" },
      selection: { anchor: line.from + "仍在编辑".length },
    });
    expect(serializeTranscriptEditorState(view.state)[2]!.text).toBe("仍在编辑");
    expect(view.state.selection.main.head).toBe(line.from + "仍在编辑".length);
  });

  it("ArrowDown moves primary, syncs multi-select, and notifies host bridge", () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    const onPrimaryMoved = vi.fn();
    const state = buildTranscriptEditorState(makeSegments(5), {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: true }),
        transcriptLineCountGuard,
        transcriptEditorKeymap,
      ],
    });
    view = new EditorView({ state, parent: root });
    selectSegmentCommand(view, 1);
    selectSegmentCommand(view, 3, { toggle: true });
    expect(primarySegmentIdx(view.state)).toBe(3);
    expect(getTranscriptMultiSelection(view.state).selectedSet.size).toBe(2);

    // Non-shift arrow replaces multi with the new primary (no ghost selection).
    expect(runTranscriptArrowMove(view, 1, { onPrimaryMoved })).toBe(true);
    expect(primarySegmentIdx(view.state)).toBe(4);
    expect([...getTranscriptMultiSelection(view.state).selectedSet]).toEqual([4]);
    expect(onPrimaryMoved).toHaveBeenCalledWith(4, { shiftKey: undefined });

    selectSegmentCommand(view, 2);
    expect(runTranscriptArrowMove(view, 1, { shiftKey: true, onPrimaryMoved })).toBe(true);
    expect(primarySegmentIdx(view.state)).toBe(3);
    expect([...getTranscriptMultiSelection(view.state).selectedSet].sort((a, b) => a - b)).toEqual([
      2, 3,
    ]);
    expect(onPrimaryMoved).toHaveBeenLastCalledWith(3, { shiftKey: true });
  });
});

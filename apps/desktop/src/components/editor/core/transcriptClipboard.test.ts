// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { buildTranscriptEditorState } from "./buildTranscriptEditorState";
import { transcriptEditorCoreExtensions } from "./transcriptEditorCoreExtensions";
import { TRANSCRIPT_NEWLINE_ESCAPE } from "./segmentNewlineCodec";
import {
  copyTranscriptSelection,
  cutTranscriptSelection,
  pasteTranscriptClipboard,
  readTranscriptClipboardSelectionText,
  transcriptSelectionIsSingleLine,
} from "./transcriptClipboard";

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

describe("transcriptClipboard", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
    vi.unstubAllGlobals();
  });

  function mount(): EditorView {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: transcriptEditorCoreExtensions({ withProjection: false }),
    });
    view = new EditorView({ state, parent });
    return view;
  }

  it("encodes pasted newlines so line count stays stable", () => {
    const v = mount();
    const line = v.state.doc.line(1);
    v.dispatch({ selection: EditorSelection.cursor(line.to) });
    const beforeLines = v.state.doc.lines;
    // Simulate CM6 paste path: input filter then insert.
    const filtered = encodeViaFilter(v, "甲\n乙");
    expect(filtered).toBe(`甲${TRANSCRIPT_NEWLINE_ESCAPE}乙`);
    v.dispatch({
      changes: { from: line.to, to: line.to, insert: filtered },
      userEvent: "input.paste",
    });
    expect(v.state.doc.lines).toBe(beforeLines);
    expect(v.state.doc.line(1).text).toContain(TRANSCRIPT_NEWLINE_ESCAPE);
  });

  it("copy writes decoded selection to clipboard", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText, readText: vi.fn() },
    });
    const v = mount();
    const line = v.state.doc.line(1);
    // Embed escaped newline in doc, select whole line.
    v.dispatch({
      changes: {
        from: line.from,
        to: line.to,
        insert: `前${TRANSCRIPT_NEWLINE_ESCAPE}后`,
      },
      selection: EditorSelection.range(line.from, line.from + 3),
    });
    // re-read line after change
    const line2 = v.state.doc.line(1);
    v.dispatch({
      selection: EditorSelection.range(line2.from, line2.to),
    });
    expect(readTranscriptClipboardSelectionText(v)).toBe("前\n后");
    expect(await copyTranscriptSelection(v)).toBe(true);
    expect(writeText).toHaveBeenCalledWith("前\n后");
  });

  it("cut removes single-line selection after copying", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText, readText: vi.fn() },
    });
    const v = mount();
    const line = v.state.doc.line(2);
    v.dispatch({
      selection: EditorSelection.range(line.from, line.to),
    });
    expect(transcriptSelectionIsSingleLine(v)).toBe(true);
    expect(await cutTranscriptSelection(v)).toBe(true);
    expect(writeText).toHaveBeenCalledWith("语段1");
    expect(v.state.doc.line(2).text).toBe("");
    expect(v.state.doc.lines).toBe(3);
  });

  it("copy with empty caret copies the current line without deleting", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText, readText: vi.fn() },
    });
    const v = mount();
    const line = v.state.doc.line(2);
    v.dispatch({ selection: EditorSelection.cursor(line.from + 1) });
    expect(await copyTranscriptSelection(v)).toBe(true);
    expect(writeText).toHaveBeenCalledWith("语段1");
    expect(v.state.doc.line(2).text).toBe("语段1");
  });

  it("cut with empty caret clears current line text but keeps line count", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText, readText: vi.fn() },
    });
    const v = mount();
    const line = v.state.doc.line(1);
    v.dispatch({ selection: EditorSelection.cursor(line.from) });
    expect(await cutTranscriptSelection(v)).toBe(true);
    expect(writeText).toHaveBeenCalledWith("语段0");
    expect(v.state.doc.line(1).text).toBe("");
    expect(v.state.doc.lines).toBe(3);
  });

  it("paste inserts encoded clipboard text at caret", async () => {
    const readText = vi.fn(() => Promise.resolve("外\n部"));
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn(), readText },
    });
    const v = mount();
    const line = v.state.doc.line(1);
    v.dispatch({ selection: EditorSelection.cursor(line.to) });
    expect(await pasteTranscriptClipboard(v)).toBe(true);
    expect(v.state.doc.lines).toBe(3);
    expect(v.state.doc.line(1).text).toBe(`语段0外${TRANSCRIPT_NEWLINE_ESCAPE}部`);
  });
});

function encodeViaFilter(view: EditorView, text: string): string {
  // Mirror EditorView.clipboardInputFilter application used by CM6 paste.
  const facet = EditorView.clipboardInputFilter;
  const filters = view.state.facet(facet);
  return filters.reduce((acc, fn) => fn(acc, view.state), text);
}

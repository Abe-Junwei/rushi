import { describe, expect, it, afterEach } from "vitest";
import { EditorSelection } from "@codemirror/state";
import type { SegmentDto } from "../../../../tauri/projectTypes";
import {
  buildSpikeEditorState,
  serializeSpikeEditorState,
} from "./buildSpikeEditorState";
import { mountSpikeEditor, spikeSelectSegmentLine } from "./createSpikeEditor";
import {
  auditSegmentNewlines,
  encodeNewlinesForSingleLineDoc,
  SPIKE_NEWLINE_ESCAPE,
} from "./auditSegmentNewlines";
import { spikeSegmentMetaField } from "./segmentMeta";

function makeSegments(n: number, over: Partial<SegmentDto> = {}): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i * 2,
    end_sec: i * 2 + 1.5,
    text: `语段 ${i}`,
    ...over,
  }));
}

describe("P0 spike: buildSpikeEditorState", () => {
  it("round-trips segments without newlines", () => {
    const segments = makeSegments(5);
    const state = buildSpikeEditorState(segments);
    expect(state.doc.lines).toBe(5);
    expect(state.field(spikeSegmentMetaField)).toHaveLength(5);
    const back = serializeSpikeEditorState(state);
    expect(back.map((s) => s.text)).toEqual(segments.map((s) => s.text));
    expect(back.map((s) => s.uid)).toEqual(segments.map((s) => s.uid));
    expect(back.map((s) => s.start_sec)).toEqual(segments.map((s) => s.start_sec));
  });

  it("does not silently strip embedded newlines when encode is off (line count would diverge)", () => {
    const segments: SegmentDto[] = [
      {
        uid: "a",
        idx: 0,
        start_sec: 0,
        end_sec: 1,
        text: "line1\nline2",
      },
      {
        uid: "b",
        idx: 1,
        start_sec: 1,
        end_sec: 2,
        text: "ok",
      },
    ];
    const state = buildSpikeEditorState(segments, { encodeEmbeddedNewlines: false });
    // Naive join creates 3 lines — proves why audit/encode is required before build.
    expect(state.doc.lines).toBe(3);
    expect(state.field(spikeSegmentMetaField)).toHaveLength(2);
  });

  it("default encode keeps line count == segment count and round-trips newlines", () => {
    const raw: SegmentDto[] = [
      {
        uid: "a",
        idx: 0,
        start_sec: 0,
        end_sec: 1,
        text: "line1\nline2",
      },
      {
        uid: "b",
        idx: 1,
        start_sec: 1,
        end_sec: 2,
        text: "ok",
      },
    ];
    const state = buildSpikeEditorState(raw);
    expect(state.doc.lines).toBe(2);
    expect(state.doc.line(1).text).toContain(SPIKE_NEWLINE_ESCAPE);
    const back = serializeSpikeEditorState(state);
    expect(back[0]!.text).toBe("line1\nline2");
    expect(back[1]!.text).toBe("ok");
  });

  it("keeps line count == segment count when newlines are explicitly encoded", () => {
    const raw: SegmentDto[] = [
      {
        uid: "a",
        idx: 0,
        start_sec: 0,
        end_sec: 1,
        text: "line1\nline2",
      },
      {
        uid: "b",
        idx: 1,
        start_sec: 1,
        end_sec: 2,
        text: "ok",
      },
    ];
    const encoded = raw.map((s) => ({
      ...s,
      text: encodeNewlinesForSingleLineDoc(s.text),
    }));
    // Already encoded input + default encode is idempotent for U+240A (no extra \n).
    const state = buildSpikeEditorState(encoded);
    expect(state.doc.lines).toBe(2);
    const back = serializeSpikeEditorState(state);
    expect(back[0]!.text).toBe("line1\nline2");
  });
});

describe("P0 spike: auditSegmentNewlines", () => {
  it("reports hits and hitRate", () => {
    const segments = makeSegments(4);
    segments[1] = { ...segments[1]!, text: "a\nb" };
    segments[3] = { ...segments[3]!, text: "x\ry" };
    const audit = auditSegmentNewlines(segments);
    expect(audit.totalSegments).toBe(4);
    expect(audit.hits).toHaveLength(2);
    expect(audit.hitRate).toBe(0.5);
  });
});

describe("P0 spike: mount + gutter + selection", () => {
  let root: HTMLDivElement | null = null;

  afterEach(() => {
    root?.remove();
    root = null;
  });

  it("mounts gutter markers and paints active line on select", () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    const segments = makeSegments(20);
    const view = mountSpikeEditor(root, segments, { heightPx: 240, editContext: false });
    try {
      expect(root.querySelector(".cm-spike-meta-gutter")).toBeTruthy();
      spikeSelectSegmentLine(view, 5);
      expect(view.state.selection.main.head).toBe(view.state.doc.line(6).from);
      const active = root.querySelector(".cm-spike-active-line");
      expect(active).toBeTruthy();
      // Gutter time for line 0 should be visible somewhere in gutter DOM.
      const gutterText = root.querySelector(".cm-spike-meta-gutter")?.textContent ?? "";
      expect(gutterText).toMatch(/\d+:\d{2}/);
    } finally {
      view.destroy();
    }
  });

  it("selection transaction updates highlight without React selectedIdx", () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    const view = mountSpikeEditor(root, makeSegments(10), { heightPx: 200 });
    try {
      const line = view.state.doc.line(3);
      view.dispatch({
        selection: EditorSelection.cursor(line.from),
      });
      expect(root.querySelector(".cm-spike-active-line")).toBeTruthy();
    } finally {
      view.destroy();
    }
  });
});

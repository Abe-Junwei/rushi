// @vitest-environment jsdom

import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  buildTranscriptEditorState,
  serializeTranscriptEditorState,
  segmentMetaField,
  createTransactionPersistenceBridge,
  TRANSCRIPT_NEWLINE_ESCAPE,
  auditSegmentNewlines,
  readTranscriptEditorCoreEnabled,
  writeTranscriptEditorCoreEnabled,
  setTranscriptEditorCoreEnabledForTests,
  TRANSCRIPT_EDITOR_CORE_FLAG_KEY,
} from "./index";

function installMockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}

function makeSegments(n: number, over: Partial<SegmentDto> = {}): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 0.5,
    text: `语段 ${i}`,
    ...over,
  }));
}

describe("P1 build/serializeTranscriptEditorState", () => {
  it("round-trips plain segments", () => {
    const segments = makeSegments(4);
    const state = buildTranscriptEditorState(segments);
    expect(state.doc.lines).toBe(4);
    expect(state.field(segmentMetaField)).toHaveLength(4);
    const back = serializeTranscriptEditorState(state);
    expect(back.map((s) => s.text)).toEqual(segments.map((s) => s.text));
    expect(back.map((s) => s.uid)).toEqual(segments.map((s) => s.uid));
    expect(back.map((s) => s.start_sec)).toEqual(segments.map((s) => s.start_sec));
  });

  it("handles empty segment, emoji, and CJK", () => {
    const segments: SegmentDto[] = [
      { uid: "e", idx: 0, start_sec: 0, end_sec: 1, text: "" },
      { uid: "z", idx: 1, start_sec: 1, end_sec: 2, text: "你好 👋🌍" },
    ];
    const back = serializeTranscriptEditorState(buildTranscriptEditorState(segments));
    expect(back[0].text).toBe("");
    expect(back[1].text).toBe("你好 👋🌍");
  });

  it("encodes embedded newlines reversibly (default)", () => {
    const segments: SegmentDto[] = [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a\nb" },
      { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "ok" },
    ];
    const state = buildTranscriptEditorState(segments);
    expect(state.doc.lines).toBe(2);
    expect(state.doc.line(1).text).toContain(TRANSCRIPT_NEWLINE_ESCAPE);
    expect(serializeTranscriptEditorState(state)[0].text).toBe("a\nb");
  });

  it("auditSegmentNewlines reports hits", () => {
    const segments = makeSegments(3);
    segments[1] = { ...segments[1], text: "x\ny" };
    const audit = auditSegmentNewlines(segments);
    expect(audit.hits).toHaveLength(1);
    expect(audit.hitRate).toBeCloseTo(1 / 3);
  });
});

describe("P1 transactionPersistenceBridge", () => {
  let root: HTMLDivElement | null = null;

  afterEach(() => {
    root?.remove();
    root = null;
  });

  it("projects SegmentDto[] on doc text change only", () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    const projected: SegmentDto[][] = [];
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: [
        createTransactionPersistenceBridge({
          onSegmentsProjected: (segs) => projected.push(segs),
        }),
      ],
    });
    const view = new EditorView({ state, parent: root });
    try {
      expect(projected).toHaveLength(0);
      const line = view.state.doc.line(2);
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "改写后的正文" },
      });
      expect(projected).toHaveLength(1);
      expect(projected[0][1].text).toBe("改写后的正文");
      expect(projected[0][0].text).toBe("语段 0");
      // Selection-only dispatch must not project.
      view.dispatch({ selection: { anchor: line.from } });
      expect(projected).toHaveLength(1);
    } finally {
      view.destroy();
    }
  });
});

describe("P1 transcriptEditorCoreFlag", () => {
  beforeEach(() => {
    installMockLocalStorage();
    setTranscriptEditorCoreEnabledForTests(null);
  });

  afterEach(() => {
    setTranscriptEditorCoreEnabledForTests(null);
    window.localStorage.removeItem(TRANSCRIPT_EDITOR_CORE_FLAG_KEY);
  });

  it("defaults on when unset", () => {
    window.localStorage.removeItem(TRANSCRIPT_EDITOR_CORE_FLAG_KEY);
    expect(readTranscriptEditorCoreEnabled()).toBe(true);
  });

  it("is permanently enabled (P9a; write is no-op)", () => {
    writeTranscriptEditorCoreEnabled(true);
    expect(readTranscriptEditorCoreEnabled()).toBe(true);
    writeTranscriptEditorCoreEnabled(false);
    expect(readTranscriptEditorCoreEnabled()).toBe(true);
  });
});

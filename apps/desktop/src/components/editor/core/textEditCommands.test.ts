// @vitest-environment jsdom

import { describe, expect, it, afterEach } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  buildTranscriptEditorState,
  transcriptEditorCoreExtensions,
  transcriptLineCountGuard,
  serializeTranscriptEditorState,
  replaceSegmentCharRangeCommand,
  replaceSegmentLineTextCommand,
  applySegmentTextsBulkCommand,
  setTranscriptPanelHighlightEffect,
  transcriptPanelHighlightField,
  segmentCharRangeToDocRange,
  TRANSCRIPT_NEWLINE_ESCAPE,
} from "./index";
import { encodeSegmentTextForDocLine as enc } from "./segmentNewlineCodec";

function makeSegs(texts: string[]): SegmentDto[] {
  return texts.map((text, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 1,
    text,
    kind: "speech" as const,
  }));
}

describe("P7 textEditCommands + panel highlight", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
  });

  function mount(segs: SegmentDto[]) {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(segs, {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: false, withMetaGutter: false }),
        transcriptLineCountGuard,
      ],
    });
    view = new EditorView({ state, parent });
    return view;
  }

  it("replaces a char range inside a line", () => {
    const segs = makeSegs(["你好世界"]);
    const v = mount(segs);
    expect(replaceSegmentCharRangeCommand(v, 0, 2, 2, "宇宙")).toBe(true);
    expect(serializeTranscriptEditorState(v.state)[0].text).toBe("你好宇宙");
  });

  it("replaces full line text and bulk updates", () => {
    const segs = makeSegs(["甲", "乙", "丙"]);
    const v = mount(segs);
    expect(replaceSegmentLineTextCommand(v, 1, "乙改")).toBe(true);
    expect(applySegmentTextsBulkCommand(v, [
      { segmentIdx: 0, text: "甲改" },
      { segmentIdx: 2, text: "丙改" },
    ])).toBe(true);
    expect(serializeTranscriptEditorState(v.state).map((s) => s.text)).toEqual([
      "甲改",
      "乙改",
      "丙改",
    ]);
  });

  it("maps decoded char ranges across encoded newlines", () => {
    const text = `上${"\n"}下`;
    const segs = makeSegs([text]);
    const v = mount(segs);
    const line = v.state.doc.line(1);
    expect(line.text).toBe(enc(text));
    const range = segmentCharRangeToDocRange(v.state, 0, 1, 2);
    expect(range).not.toBeNull();
    // char 1 is the newline in decoded text → U+240A in doc
    expect(v.state.doc.sliceString(range!.from, range!.to)).toBe(TRANSCRIPT_NEWLINE_ESCAPE);
  });

  it("applies panel highlight mark decoration", () => {
    const segs = makeSegs(["查找高亮"]);
    const v = mount(segs);
    v.dispatch({
      effects: setTranscriptPanelHighlightEffect.of({
        segmentIdx: 0,
        charStart: 0,
        charEnd: 2,
      }),
    });
    const field = v.state.field(transcriptPanelHighlightField);
    expect(field.highlight?.charEnd).toBe(2);
    expect(field.decorations.size).toBe(1);
  });
});

// @vitest-environment jsdom

import { describe, expect, it, afterEach } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  buildTranscriptEditorState,
  transcriptEditorCoreExtensions,
  transcriptLineCountGuard,
  serializeTranscriptEditorState,
  segmentMetaField,
  splitSegmentAtMidpointCommand,
  mergeWithNextCommand,
  deleteSegmentAtCommand,
  deleteSegmentIndicesCommand,
  insertSegmentAtCommand,
  mergeProjectedStructureWithBaseline,
  primarySegmentIdx,
  replaceTranscriptSegmentsTransaction,
  selectSegmentCommand,
} from "./index";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 1,
    text: `语段${i}内容较长一些`,
    kind: "speech" as const,
    confidence: 0.9,
    annotation: i === 0 ? "备注" : null,
    text_stage: "auto_transcribe" as const,
  }));
}

describe("P6 structureCommands", () => {
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

  it("splits at midpoint: line count +1, meta synced, preserves left uid", () => {
    const segs = makeSegments(2);
    const v = mount(segs);
    expect(splitSegmentAtMidpointCommand(v, segs, 0)).toBe(true);
    expect(v.state.doc.lines).toBe(3);
    expect(v.state.field(segmentMetaField)).toHaveLength(3);
    const out = serializeTranscriptEditorState(v.state);
    expect(out[0].uid).toBe("u0");
    expect(out[0].end_sec).toBeCloseTo(0.5, 5);
    expect(out[1].start_sec).toBeCloseTo(0.5, 5);
    expect(out[1].uid).not.toBe("u0");
    expect(primarySegmentIdx(v.state)).toBe(1);
  });

  it("rejects split when segment too short", () => {
    const segs: SegmentDto[] = [
      {
        uid: "short",
        idx: 0,
        start_sec: 0,
        end_sec: 0.03,
        text: "x",
      },
    ];
    const v = mount(segs);
    expect(splitSegmentAtMidpointCommand(v, segs, 0)).toBe(false);
    expect(v.state.doc.lines).toBe(1);
  });

  it("merges with next and keeps left uid", () => {
    const segs = makeSegments(3);
    const v = mount(segs);
    expect(mergeWithNextCommand(v, segs, 0)).toBe(true);
    expect(v.state.doc.lines).toBe(2);
    const out = serializeTranscriptEditorState(v.state);
    expect(out[0].uid).toBe("u0");
    expect(out[0].text).toBe("语段0内容较长一些语段1内容较长一些");
    expect(out[0].text).not.toMatch(/[\n\r\u240A]/);
    expect(v.state.doc.line(1).text).not.toMatch(/[\n\r\u240A]/);
    expect(primarySegmentIdx(v.state)).toBe(0);
  });

  it("structure replace does not request CM scrollIntoView (avoids tall-merge jump)", () => {
    const segs = makeSegments(2);
    const state = buildTranscriptEditorState(segs, {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: false, withMetaGutter: false }),
        transcriptLineCountGuard,
      ],
    });
    const tr = replaceTranscriptSegmentsTransaction(state, segs.slice(0, 1), 0);
    expect(tr?.scrollIntoView).toBe(false);
  });

  it("deletes a segment and clamps primary", () => {
    const segs = makeSegments(3);
    const v = mount(segs);
    expect(deleteSegmentAtCommand(v, segs, 1)).toBe(true);
    expect(v.state.doc.lines).toBe(2);
    expect(serializeTranscriptEditorState(v.state).map((s) => s.uid)).toEqual(["u0", "u2"]);
  });

  it("delete preserves primary when removing a non-selected segment", () => {
    const segs = makeSegments(5);
    const v = mount(segs);
    selectSegmentCommand(v, 3, { scrollIntoView: false });
    expect(deleteSegmentAtCommand(v, segs, 1)).toBe(true);
    expect(primarySegmentIdx(v.state)).toBe(2);
    expect(serializeTranscriptEditorState(v.state).map((s) => s.uid)).toEqual([
      "u0",
      "u2",
      "u3",
      "u4",
    ]);
  });

  it("sparse-deletes non-contiguous indices and remaps primary", () => {
    const segs = makeSegments(5);
    const v = mount(segs);
    expect(deleteSegmentIndicesCommand(v, segs, [1, 3], 3)).toBe(true);
    expect(v.state.doc.lines).toBe(3);
    expect(serializeTranscriptEditorState(v.state).map((s) => s.uid)).toEqual(["u0", "u2", "u4"]);
    // prev primary 3 deleted → next kept old idx 4 → new primary 2
    expect(primarySegmentIdx(v.state)).toBe(2);
  });

  it("inserts a segment at index and selects it", () => {
    const segs = makeSegments(2);
    const v = mount(segs);
    const neu: SegmentDto = {
      uid: "new",
      idx: 0,
      start_sec: 0.4,
      end_sec: 0.6,
      text: "",
      kind: "speech",
      text_stage: "manual_transcribe",
    };
    expect(insertSegmentAtCommand(v, segs, 1, neu)).toBe(true);
    expect(v.state.doc.lines).toBe(3);
    const out = serializeTranscriptEditorState(v.state);
    expect(out.map((s) => s.uid)).toEqual(["u0", "new", "u1"]);
    expect(out[1].start_sec).toBeCloseTo(0.4, 5);
    expect(primarySegmentIdx(v.state)).toBe(1);
  });

  it("mergeProjectedStructureWithBaseline preserves annotation/confidence", () => {
    const baseline = makeSegments(2);
    const projected: SegmentDto[] = [
      {
        uid: "u0",
        idx: 0,
        start_sec: 0,
        end_sec: 0.5,
        text: "左",
        text_stage: "auto_transcribe",
      },
      {
        uid: "new-right",
        idx: 1,
        start_sec: 0.5,
        end_sec: 1,
        text: "右",
        text_stage: "auto_transcribe",
      },
      {
        uid: "u1",
        idx: 2,
        start_sec: 1,
        end_sec: 2,
        text: "语段1内容较长一些",
        text_stage: "auto_transcribe",
      },
    ];
    const merged = mergeProjectedStructureWithBaseline(baseline, projected);
    expect(merged[0].annotation).toBe("备注");
    expect(merged[0].confidence).toBe(0.9);
    expect(merged[0].kind).toBe("speech");
    expect(merged[1].uid).toBe("new-right");
    expect(merged[2].confidence).toBe(0.9);
  });
});

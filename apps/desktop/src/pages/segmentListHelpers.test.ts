import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  buildSplitPair,
  findSegmentIndexByUid,
  mergeTwoSegments,
  normalizeSegmentList,
  prepareSegmentsForPersist,
  segmentsEqualForPersist,
  sortSegmentsByStartSec,
  splitSegmentTextByTimeRatio,
} from "./segmentListHelpers";
import { ensureUniqueSegmentUids } from "../utils/segmentUid";
import { isPlaceholderSegment } from "../utils/waveformSegmentBounds";

function seg(
  props: Partial<SegmentDto> & { start_sec: number; end_sec: number; text: string },
): SegmentDto {
  return {
    idx: 0,
    confidence: null,
    low_confidence: false,
    detail: null,
    uid: "uid-a",
    ...props,
  };
}

describe("segmentListHelpers", () => {
  it("mergeTwoSegments marks the result as explicit speech (not heuristically hidden)", () => {
    // Two segments whose merge spans >85% of a short clip would trip the heuristic.
    const merged = mergeTwoSegments(
      seg({ uid: "a", start_sec: 0, end_sec: 5, text: "a" }),
      seg({ uid: "b", start_sec: 5, end_sec: 9.5, text: "b" }),
    );
    expect(merged.kind).toBe("speech");
    expect(isPlaceholderSegment(merged, 10)).toBe(false);
  });

  it("mergeTwoSegments downgrades to the least confirmed stage", () => {
    const merged = mergeTwoSegments(
      seg({
        uid: "a",
        start_sec: 0,
        end_sec: 5,
        text: "a",
        text_stage: "finalized",
        finalize_via: "confirm_edit",
      }),
      seg({
        uid: "b",
        start_sec: 5,
        end_sec: 9,
        text: "b",
        text_stage: "auto_transcribe",
      }),
    );
    expect(merged.text_stage).toBe("auto_transcribe");
    expect(merged.finalize_via).toBeNull();
  });

  it("mergeTwoSegments keeps manual when paired with finalized", () => {
    const merged = mergeTwoSegments(
      seg({
        uid: "a",
        start_sec: 0,
        end_sec: 5,
        text: "a",
        text_stage: "manual_transcribe",
        finalize_via: null,
      }),
      seg({
        uid: "b",
        start_sec: 5,
        end_sec: 9,
        text: "b",
        text_stage: "finalized",
        finalize_via: "mark_only",
      }),
    );
    expect(merged.text_stage).toBe("manual_transcribe");
    expect(merged.finalize_via).toBeNull();
  });

  it("mergeTwoSegments keeps finalized only when both are finalized", () => {
    const merged = mergeTwoSegments(
      seg({
        uid: "a",
        start_sec: 0,
        end_sec: 5,
        text: "a",
        text_stage: "finalized",
        finalize_via: "confirm_edit",
      }),
      seg({ uid: "b", start_sec: 5, end_sec: 9, text: "b", text_stage: "auto_transcribe" }),
    );
    expect(merged.text_stage).toBe("auto_transcribe");
    expect(merged.finalize_via).toBeNull();
  });

  it("mergeTwoSegments downgrades finalize_via to mark_only when either side used it", () => {
    const merged = mergeTwoSegments(
      seg({
        uid: "a",
        start_sec: 0,
        end_sec: 5,
        text: "a",
        text_stage: "finalized",
        finalize_via: "confirm_edit",
      }),
      seg({
        uid: "b",
        start_sec: 5,
        end_sec: 9,
        text: "b",
        text_stage: "finalized",
        finalize_via: "mark_only",
      }),
    );
    expect(merged.text_stage).toBe("finalized");
    expect(merged.finalize_via).toBe("mark_only");
  });

  it("buildSplitPair inherits left stage and resets right to auto_transcribe", () => {
    const pair = buildSplitPair(
      seg({
        uid: "a",
        start_sec: 0,
        end_sec: 10,
        text: "parent",
        text_stage: "finalized",
        finalize_via: "mark_only",
      }),
      5,
    );
    expect(pair?.left.text_stage).toBe("finalized");
    expect(pair?.left.finalize_via).toBe("mark_only");
    expect(pair?.right.text_stage).toBe("auto_transcribe");
    expect(pair?.right.finalize_via).toBeNull();
  });

  it("buildSplitPair marks both halves as explicit speech", () => {
    const pair = buildSplitPair(
      seg({ uid: "a", start_sec: 0, end_sec: 100, text: "whole", kind: "placeholder" }),
      40,
    );
    expect(pair?.left.kind).toBe("speech");
    expect(pair?.right.kind).toBe("speech");
  });

  it("mergeTwoSegments concatenates annotations per B5–B7", () => {
    const merged = mergeTwoSegments(
      seg({ start_sec: 0, end_sec: 1, text: "a", annotation: "L" }),
      seg({ start_sec: 1, end_sec: 2, text: "b", annotation: "R" }),
    );
    expect(merged.annotation).toBe("L\n\n---\n\nR");
  });

  it("buildSplitPair keeps annotation on left and clears right", () => {
    const pair = buildSplitPair(
      seg({ uid: "a", start_sec: 0, end_sec: 10, text: "parent", annotation: "note" }),
      5,
    );
    expect(pair?.left.annotation).toBe("note");
    expect(pair?.right.annotation).toBeNull();
  });

  it("splitSegmentTextByTimeRatio divides text by time proportion", () => {
    expect(splitSegmentTextByTimeRatio("abcdef", 5, 0, 10)).toEqual({ left: "abc", right: "def" });
    expect(splitSegmentTextByTimeRatio("hello world", 1, 0, 2)).toEqual({
      left: "hello ",
      right: "world",
    });
  });

  it("buildSplitPair assigns proportional text to left and right halves", () => {
    const pair = buildSplitPair(seg({ uid: "a", start_sec: 0, end_sec: 10, text: "abcdefghij" }), 5);
    expect(pair?.left.text).toBe("abcde");
    expect(pair?.right.text).toBe("fghij");
  });

  it("segmentsEqualForPersist compares annotation", () => {
    const a = [seg({ start_sec: 0, end_sec: 1, text: "x", annotation: "n" })];
    const b = [seg({ start_sec: 0, end_sec: 1, text: "x", annotation: null })];
    expect(segmentsEqualForPersist(a, a)).toBe(true);
    expect(segmentsEqualForPersist(a, b)).toBe(false);
  });

  it("sortSegmentsByStartSec orders by start_sec and reindexes", () => {
    const input = [
      seg({ uid: "b", start_sec: 5, end_sec: 6, text: "b" }),
      seg({ uid: "a", start_sec: 1, end_sec: 2, text: "a" }),
    ];
    const out = sortSegmentsByStartSec(input);
    expect(out.map((s) => s.text)).toEqual(["a", "b"]);
    expect(out.map((s) => s.idx)).toEqual([0, 1]);
  });

  it("ensureUniqueSegmentUids reassigns duplicates", () => {
    const input = [
      seg({ uid: "dup", start_sec: 0, end_sec: 1, text: "a" }),
      seg({ uid: "dup", start_sec: 2, end_sec: 3, text: "b" }),
    ];
    const out = ensureUniqueSegmentUids(input);
    expect(out[0]?.uid).toBe("dup");
    expect(out[1]?.uid).not.toBe("dup");
  });

  it("normalizeSegmentList sorts and dedupes uids", () => {
    const out = normalizeSegmentList([
      seg({ uid: "dup", start_sec: 4, end_sec: 5, text: "late" }),
      seg({ uid: "dup", start_sec: 1, end_sec: 2, text: "early" }),
    ]);
    expect(out[0]?.text).toBe("early");
    expect(out[1]?.text).toBe("late");
    expect(new Set(out.map((s) => s.uid)).size).toBe(2);
  });

  it("normalizeSegmentList assigns speech kind to ASR segments missing kind", () => {
    const out = normalizeSegmentList([
      seg({ uid: "1", start_sec: 0, end_sec: 2, text: "asr" }),
    ]);
    expect(out[0]?.kind).toBe("speech");
  });

  it("normalizeSegmentList trims ASR boundary overlap on load", () => {
    const out = normalizeSegmentList([
      seg({ uid: "2", start_sec: 10, end_sec: 22, text: "b" }),
      seg({ uid: "1", start_sec: 0, end_sec: 10.6, text: "a" }),
    ]);
    expect(out[0]?.text).toBe("a");
    expect(out[0]?.end_sec).toBe(10);
    expect(out[1]?.text).toBe("b");
  });

  it("findSegmentIndexByUid returns array index", () => {
    const list = [
      seg({ uid: "x", start_sec: 0, end_sec: 1, text: "a" }),
      seg({ uid: "y", start_sec: 2, end_sec: 3, text: "b" }),
    ];
    expect(findSegmentIndexByUid(list, "y")).toBe(1);
  });

  it("prepareSegmentsForPersist clamps and filters when duration known", () => {
    const out = prepareSegmentsForPersist(
      [
        seg({ uid: "1", start_sec: 30, end_sec: 1000, text: "a" }),
        seg({ uid: "2", start_sec: 40, end_sec: 50, text: "b" }),
      ],
      1000,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe("b");
  });

  it("segmentsEqualForPersist compares kind", () => {
    const a = [seg({ uid: "1", start_sec: 0, end_sec: 1, text: "a", kind: "speech" })];
    const b = [seg({ uid: "1", start_sec: 0, end_sec: 1, text: "a", kind: "placeholder" })];
    expect(segmentsEqualForPersist(a, a)).toBe(true);
    expect(segmentsEqualForPersist(a, b)).toBe(false);
  });
});

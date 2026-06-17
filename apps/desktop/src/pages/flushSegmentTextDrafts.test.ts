import { flushSync } from "react-dom";
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRef, useState, type SetStateAction } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  commitSegmentTextDraftsForStructureMutation,
  flushSegmentTextDrafts,
  materializeSegmentTextDrafts,
  prepareSegmentTextDraftsForMutation,
  publishSegmentTextBulkMutation,
  publishTranscribeSegmentClear,
  publishTranscribeSegmentRestore,
  syncDomTextareaDraftsIntoStore,
  syncDomTextareasFromSegments,
  syncFocusedDomTextIntoSegments,
} from "./flushSegmentTextDrafts";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import { useSegmentUndoRedo } from "./useSegmentUndoRedo";

function seg(text: string): SegmentDto {
  return {
    idx: 0,
    uid: "uid-a",
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("flushSegmentTextDrafts undo", () => {
  it("draft-only flush then undo restores text before auto-save", () => {
    segmentDraftStore.resetAll();
    const initial = seg("before blur");

    const { result } = renderHook(() => {
      const segmentsRef = useRef<SegmentDto[]>([initial]);
      const [segments, setSegments] = useState<SegmentDto[]>([initial]);
      segmentsRef.current = segments;
      const undoRedo = useSegmentUndoRedo(segmentsRef, setSegments, () => segmentsRef.current);
      return { segmentsRef, setSegments, undoRedo, segments };
    });

    const key = segmentDraftKey(initial, 0);
    segmentDraftStore.setDraft(key, "typed without blur");

    act(() => {
      flushSegmentTextDrafts(result.current.segmentsRef, result.current.setSegments, {
        beforeApplyUpdates: (updates) => {
          for (const { idx } of updates) {
            result.current.undoRedo.pushUndoForTextEdit(idx);
          }
        },
      });
    });

    expect(result.current.segments[0]?.text).toBe("typed without blur");

    act(() => {
      result.current.undoRedo.undo();
    });

    expect(result.current.segments[0]?.text).toBe("before blur");
  });

  it("syncDomTextareaDraftsIntoStore reads live textarea value before flush", () => {
    segmentDraftStore.resetAll();
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "1");
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    textarea.value = "typed in dom only";
    row.appendChild(textarea);
    document.body.appendChild(row);

    const segments: SegmentDto[] = [
      { ...seg("a"), uid: "uid-a", idx: 0 },
      { ...seg("b"), uid: "uid-b", idx: 1 },
    ];

    syncDomTextareaDraftsIntoStore(segments);
    expect(segmentDraftStore.getDraft(segmentDraftKey(segments[1], 1))).toBe("typed in dom only");

    row.remove();
  });

  it("flush applies drafts using segmentsRef when React state is stale", () => {
    segmentDraftStore.resetAll();
    const refSeg = { ...seg("ref committed"), uid: "uid-ref" };
    const staleSeg = { ...seg("stale react"), uid: "uid-stale" };

    const segmentsRef: { current: SegmentDto[] } = { current: [refSeg] };
    let reactState: SegmentDto[] = [staleSeg];
    const setSegments = (updater: SetStateAction<SegmentDto[]>) => {
      flushSync(() => {
        reactState = typeof updater === "function" ? updater(reactState) : updater;
        segmentsRef.current = reactState;
      });
    };

    const key = segmentDraftKey(refSeg, 0);
    segmentDraftStore.setDraft(key, "draft on ref row");

    flushSegmentTextDrafts(segmentsRef, setSegments);

    expect(reactState[0]?.text).toBe("draft on ref row");
    expect(segmentsRef.current[0]?.text).toBe("draft on ref row");
  });

  it("prepareSegmentTextDraftsForMutation aligns DOM to segments without importing stale DOM to draft", () => {
    segmentDraftStore.resetAll();
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "0");
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    textarea.value = "stale dom";
    row.appendChild(textarea);
    document.body.appendChild(row);

    const segments = [seg("committed in ref")];
    prepareSegmentTextDraftsForMutation(segments);

    expect(textarea.value).toBe("committed in ref");
    expect(segmentDraftStore.getDraft(segmentDraftKey(segments[0], 0))).toBeUndefined();

    row.remove();
  });

  it("syncDomTextareasFromSegments overwrites stale textarea DOM from segments", () => {
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "0");
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    textarea.value = "stale dom";
    row.appendChild(textarea);
    document.body.appendChild(row);

    syncDomTextareasFromSegments([seg("committed")]);
    expect(textarea.value).toBe("committed");

    row.remove();
  });

  it("materializeSegmentTextDrafts applies every pending draft", () => {
    segmentDraftStore.resetAll();
    const rows: SegmentDto[] = [
      { ...seg("a"), uid: "uid-a", idx: 0 },
      { ...seg("b"), uid: "uid-b", idx: 1 },
    ];
    segmentDraftStore.setDraft(segmentDraftKey(rows[0], 0), "A*");
    segmentDraftStore.setDraft(segmentDraftKey(rows[1], 1), "B*");

    const next = materializeSegmentTextDrafts(rows);
    expect(next[0]?.text).toBe("A*");
    expect(next[1]?.text).toBe("B*");
  });

  it("syncFocusedDomTextIntoSegments writes IME/partial textarea into segmentsRef", () => {
    segmentDraftStore.resetAll();
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "0");
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    textarea.value = "组字未完成";
    row.appendChild(textarea);
    document.body.appendChild(row);

    const segmentsRef = { current: [seg("committed")] };
    segmentDraftStore.beginComposition(segmentDraftKey(segmentsRef.current[0], 0));
    textarea.focus();

    syncFocusedDomTextIntoSegments(segmentsRef);
    expect(segmentsRef.current[0]?.text).toBe("组字未完成");

    row.remove();
  });

  it("commitSegmentTextDraftsForStructureMutation includes focused textarea before merge", () => {
    segmentDraftStore.resetAll();
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "0");
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    textarea.value = "live in textarea";
    row.appendChild(textarea);
    document.body.appendChild(row);

    const segmentsRef = { current: [seg("old")] };
    let reactState = segmentsRef.current;
    const setSegments = (next: SegmentDto[] | ((p: SegmentDto[]) => SegmentDto[])) => {
      reactState = typeof next === "function" ? next(reactState) : next;
    };
    textarea.focus();

    commitSegmentTextDraftsForStructureMutation(segmentsRef, setSegments);

    expect(segmentsRef.current[0]?.text).toBe("live in textarea");
    expect(reactState[0]?.text).toBe("live in textarea");

    row.remove();
  });
});

describe("publishTranscribeSegmentClear / publishTranscribeSegmentRestore", () => {
  it("clear resets drafts before emptying segments", () => {
    segmentDraftStore.resetAll();
    const segmentsRef = { current: [seg("keep ghost")] };
    const key = segmentDraftKey(segmentsRef.current[0], 0);
    segmentDraftStore.setDraft(key, "draft ghost");

    let reactState = segmentsRef.current;
    const setSegments = (next: SetStateAction<SegmentDto[]>) => {
      reactState = typeof next === "function" ? next(segmentsRef.current) : next;
      segmentsRef.current = reactState;
    };

    publishTranscribeSegmentClear(segmentsRef, setSegments);

    expect(segmentsRef.current).toEqual([]);
    expect(segmentDraftStore.getDraft(key)).toBeUndefined();
  });

  it("restore resets drafts and syncs DOM from restored segments", () => {
    segmentDraftStore.resetAll();
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "0");
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    textarea.value = "stale dom";
    row.appendChild(textarea);
    document.body.appendChild(row);

    const restored = [seg("restored text")];
    const segmentsRef = { current: [] as SegmentDto[] };
    let reactState = segmentsRef.current;
    const setSegments = (next: SetStateAction<SegmentDto[]>) => {
      reactState = typeof next === "function" ? next(segmentsRef.current) : next;
      segmentsRef.current = reactState;
    };
    segmentDraftStore.setDraft(segmentDraftKey(restored[0], 0), "stale draft");

    publishTranscribeSegmentRestore(segmentsRef, setSegments, restored);

    expect(segmentsRef.current[0]?.text).toBe("restored text");
    expect(textarea.value).toBe("restored text");
    expect(segmentDraftStore.getDraft(segmentDraftKey(restored[0], 0))).toBeUndefined();

    row.remove();
  });
});

describe("publishSegmentTextBulkMutation", () => {
  it("clears stale drafts and DOM so a follow-up flush does not revert bulk writeback", () => {
    segmentDraftStore.resetAll();
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "0");
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    textarea.value = "箱板";
    row.appendChild(textarea);
    document.body.appendChild(row);

    const key = segmentDraftKey(seg("箱板"), 0);
    segmentDraftStore.setDraft(key, "箱板");
    segmentDraftStore.flushPendingEmit();

    const segmentsRef = { current: [seg("箱板")] };
    let reactState = segmentsRef.current;
    const setSegments = (next: SetStateAction<SegmentDto[]>) => {
      reactState = typeof next === "function" ? next(segmentsRef.current) : next;
      segmentsRef.current = reactState;
    };

    publishSegmentTextBulkMutation(segmentsRef, setSegments, [seg("相板")]);

    expect(segmentsRef.current[0]?.text).toBe("相板");
    expect(textarea.value).toBe("相板");
    expect(segmentDraftStore.getDraft(key)).toBeUndefined();

    flushSegmentTextDrafts(segmentsRef, setSegments);
    expect(segmentsRef.current[0]?.text).toBe("相板");

    row.remove();
  });
});

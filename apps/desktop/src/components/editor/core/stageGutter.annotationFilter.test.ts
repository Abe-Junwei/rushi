// @vitest-environment jsdom

/**
 * Regression: filter-collapse used to let zero-height gutter markers stack onto
 * visible rows (see meta timestamp fix in filterLineVisibility.test). Stage
 * annotation icons use the same omit-hidden-marker guard — lock that frozen
 * notes do not appear as openable (empty) icons on unfrozen rows.
 */

import { afterEach, describe, expect, it } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  buildTranscriptEditorState,
  transcriptEditorCoreExtensions,
  syncTranscriptProjectionFromView,
} from "./index";
import {
  getTranscriptFilterVisibleSet,
  setTranscriptFilterCriteriaEffect,
  setTranscriptFilterVisibleEffect,
} from "./filterLineVisibility";
import { DEFAULT_SEGMENT_LIST_FILTER } from "../../../services/segmentListFilter";
import { segmentMetaField } from "./segmentMetaField";
import { CM_SEGMENT_ANNOTATION_ATTR } from "./stageGutter";

function makeSeg(
  i: number,
  opts: { frozen?: boolean; annotation?: string | null },
): SegmentDto {
  return {
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 0.5,
    text: `语段 ${i}`,
    text_stage: "auto_transcribe",
    frozen: Boolean(opts.frozen),
    annotation: opts.annotation ?? null,
  };
}

describe("stage annotation icons under frozen/unfrozen filter", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("hides annotation buttons on filtered-out frozen rows (no stack onto unfrozen)", () => {
    // 0 unfrozen no note, 1 frozen+note, 2 unfrozen no note, 3 frozen+note, 4 unfrozen no note
    const segs = Array.from({ length: 5 }, (_, i) =>
      makeSeg(i, {
        frozen: i % 2 === 1,
        annotation: i % 2 === 1 ? `备注 ${i}` : null,
      }),
    );
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const view = new EditorView({
      state: buildTranscriptEditorState(segs, {
        extensions: transcriptEditorCoreExtensions(),
      }),
      parent,
    });
    syncTranscriptProjectionFromView(view);

    expect(view.dom.querySelectorAll(`[${CM_SEGMENT_ANNOTATION_ATTR}]`).length).toBe(2);

    const criteria = { ...DEFAULT_SEGMENT_LIST_FILTER, frozen: "unfrozen" as const };
    view.dispatch({
      effects: [
        setTranscriptFilterCriteriaEffect.of(criteria),
        setTranscriptFilterVisibleEffect.of(new Set([0, 2, 4])),
      ],
    });

    expect([...getTranscriptFilterVisibleSet(view.state)!].sort((a, b) => a - b)).toEqual([
      0, 2, 4,
    ]);
    const meta = view.state.field(segmentMetaField);
    // Data stays on the frozen indices — not remapped to visible rows.
    expect(meta.map((m) => m.hasAnnotation)).toEqual([false, true, false, true, false]);
    expect(meta.map((m) => m.frozen)).toEqual([false, true, false, true, false]);

    // UI: no openable annotation buttons remain (would otherwise open empty dialogs
    // on unfrozen rows via gutter lineBlockAtHeight hit-testing).
    expect(view.dom.querySelectorAll(`[${CM_SEGMENT_ANNOTATION_ATTR}]`).length).toBe(0);
  });

  it("adjacent frozen+note does not leave a clickable annotation affordance on the next visible row", () => {
    const segs = [
      makeSeg(0, { frozen: true, annotation: "秘密备注" }),
      makeSeg(1, { frozen: false, annotation: null }),
      makeSeg(2, { frozen: false, annotation: null }),
    ];
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const view = new EditorView({
      state: buildTranscriptEditorState(segs, {
        extensions: transcriptEditorCoreExtensions(),
      }),
      parent,
    });
    syncTranscriptProjectionFromView(view);

    view.dispatch({
      effects: setTranscriptFilterVisibleEffect.of(new Set([1, 2])),
    });

    expect(view.dom.querySelectorAll(`[${CM_SEGMENT_ANNOTATION_ATTR}]`).length).toBe(0);
    // Annotation text remains on the frozen segment; visible neighbors stay empty.
    expect(view.state.field(segmentMetaField).map((m) => m.hasAnnotation)).toEqual([
      true,
      false,
      false,
    ]);
  });
});

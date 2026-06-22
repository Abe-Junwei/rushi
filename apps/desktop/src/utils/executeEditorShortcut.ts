import { requestToggleActivityInbox } from "../services/ui/activityInboxEvents";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { useProjectWaveform } from "../hooks/useProjectWaveform";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import { readFocusedTranscriptTextareaSelection } from "../pages/flushSegmentTextDrafts";
import type { SegmentListFilterNavState } from "../utils/segmentListFilterNav";
import {
  resolveKeyboardAdvanceTarget,
  resolveListSelectionNavAnchor,
} from "./segmentListKeyboardNav";
import type { EditorShortcutId } from "./editorShortcutRegistry";
import {
  enqueueConfirmAdvanceTab,
  resolveConfirmAdvanceStartingIdx,
  type ConfirmAdvanceTabQueueRef,
} from "./confirmAdvanceTabQueue";

type WfApi = ReturnType<typeof useProjectWaveform>;

export type EditorShortcutExecuteDeps = {
  ctx: TranscriptionLayerInput;
  /** 异步 shortcut（如 Tab 定稿）完成后须读最新 ctx，避免闭包 stale。 */
  getCtx?: () => TranscriptionLayerInput;
  wf: WfApi;
  selectSegmentAt: (idx: number, source?: SegmentSelectSource, opts?: { shiftKey?: boolean }) => void;
  focusSegmentTextarea: (segmentIdx: number) => void;
  scheduleAdvanceToSegment: (targetIdx: number) => void;
  segmentListFilterNavState: SegmentListFilterNavState;
  showEditorHint: (msg: string) => void;
  stepWaveformZoom: (direction: "in" | "out") => void;
  blurActiveElement: () => void;
  confirmAdvanceQueueRef?: ConfirmAdvanceTabQueueRef | { current: ConfirmAdvanceTabQueueRef };
};

export type EditorShortcutExecuteMods = {
  shiftKey?: boolean;
  eventTarget?: EventTarget | null;
};

/** 结构操作与 focus 文本均锚定 selectedIdx（focus=selected 不变量）。 */
function resolveSelectedSegmentIdx(ctx: TranscriptionLayerInput): number {
  return ctx.selectedIdx;
}

function readCtx(deps: EditorShortcutExecuteDeps): TranscriptionLayerInput {
  return deps.getCtx?.() ?? deps.ctx;
}

export function executeEditorShortcut(
  id: EditorShortcutId,
  deps: EditorShortcutExecuteDeps,
  mods: EditorShortcutExecuteMods = {},
): boolean {
  const { ctx, wf } = deps;

  if (id === "workflow.openSettings") {
    ctx.openEnvironment();
    return true;
  }

  if (id === "workflow.openActivityInbox") {
    requestToggleActivityInbox();
    return true;
  }

  if (ctx.busy) return true;

  switch (id) {
    case "segment.mergeNext": {
      if (ctx.isMultiSegmentSelection && ctx.isContiguousSelection) {
        ctx.mergeSegmentRange(ctx.selectionLo, ctx.selectionHi);
        return true;
      }
      const idx = resolveSelectedSegmentIdx(ctx);
      if (idx >= 0 && idx < ctx.segments.length - 1) {
        ctx.mergeWithNextAt(idx);
      }
      return true;
    }
    case "segment.mergePrev": {
      if (ctx.isMultiSegmentSelection && ctx.isContiguousSelection) {
        ctx.mergeSegmentRange(ctx.selectionLo, ctx.selectionHi);
        return true;
      }
      const idx = resolveSelectedSegmentIdx(ctx);
      if (idx > 0) {
        ctx.mergeWithPrevAt(idx);
      }
      return true;
    }
    case "segment.splitPlayhead": {
      const idx = resolveSelectedSegmentIdx(ctx);
      if (idx >= 0 && idx < ctx.segments.length) {
        ctx.splitAtPlayhead(wf.getPlayheadTime());
      }
      return true;
    }
    case "segment.focusText": {
      const idx = resolveSelectedSegmentIdx(ctx);
      if (idx >= 0 && idx < ctx.segments.length) {
        deps.focusSegmentTextarea(idx);
      }
      return true;
    }
    case "segment.advancePrev": {
      const anchorIdx = resolveListSelectionNavAnchor(ctx.selectedIdx);
      const targetIdx = resolveKeyboardAdvanceTarget(
        anchorIdx,
        -1,
        ctx.segments.length,
        deps.segmentListFilterNavState,
      );
      if (targetIdx != null && targetIdx !== anchorIdx) deps.scheduleAdvanceToSegment(targetIdx);
      return true;
    }
    case "segment.advanceNext": {
      const anchorIdx = resolveListSelectionNavAnchor(ctx.selectedIdx);
      const targetIdx = resolveKeyboardAdvanceTarget(
        anchorIdx,
        1,
        ctx.segments.length,
        deps.segmentListFilterNavState,
      );
      if (targetIdx != null && targetIdx !== anchorIdx) deps.scheduleAdvanceToSegment(targetIdx);
      return true;
    }
    case "segment.delete": {
      if (ctx.segments.length === 0) return true;
      if (ctx.isMultiSegmentSelection) {
        if (ctx.isContiguousSelection) {
          ctx.requestDeleteSelection(ctx.selectionLo, ctx.selectionHi);
        } else {
          ctx.requestDeleteSelectedIndices(ctx.selectedIndicesArray);
        }
      } else {
        ctx.deleteSegmentAt(ctx.selectedIdx);
      }
      return true;
    }
    case "playback.toggle": {
      if (!ctx.mediaUrl) return true;
      void wf.togglePlay();
      return true;
    }
    case "edit.undo":
      ctx.undo();
      return true;
    case "edit.redo":
      ctx.redo();
      return true;
    case "workflow.save":
      void ctx.saveSegments();
      return true;
    case "workflow.confirmAdvance": {
      const ctx = readCtx(deps);
      const idx = resolveConfirmAdvanceStartingIdx(ctx);
      if (idx < 0 || idx >= ctx.segments.length) return true;
      const queue =
        deps.confirmAdvanceQueueRef &&
        ("current" in deps.confirmAdvanceQueueRef
          ? deps.confirmAdvanceQueueRef.current
          : deps.confirmAdvanceQueueRef);
      if (!queue) return true;
      enqueueConfirmAdvanceTab(queue, {
        getCtx: () => readCtx(deps),
        segmentListFilterNavState: deps.segmentListFilterNavState,
        selectSegmentAt: (ni, source) => deps.selectSegmentAt(ni, source),
        focusSegmentTextarea: deps.focusSegmentTextarea,
        wf,
      });
      return true;
    }
    case "workflow.find":
      ctx.triggerFindReplaceShortcut();
      return true;
    case "workflow.closeFile":
      ctx.closeFile();
      return true;
    case "workflow.segmentAnnotation": {
      const idx = resolveSelectedSegmentIdx(ctx);
      if (idx >= 0 && idx < ctx.segments.length) {
        ctx.openSegmentAnnotationDialog(idx);
      }
      return true;
    }
    case "workflow.addCorrectionMemory": {
      const text = readFocusedTranscriptTextareaSelection();
      if (text.trim()) {
        ctx.openManualCorrectionMemoryDialog(text);
      }
      return true;
    }
    case "waveform.clearSelection":
      if (ctx.isMultiSegmentSelection) {
        ctx.clearMultiSelection();
      } else {
        deps.blurActiveElement();
      }
      return true;
    case "waveform.selectSegmentPrev": {
      if (ctx.selectedIdx <= 0) return true;
      deps.selectSegmentAt(ctx.selectedIdx - 1, "waveform", {
        shiftKey: mods.shiftKey,
      });
      return true;
    }
    case "waveform.selectSegmentNext": {
      if (ctx.selectedIdx >= ctx.segments.length - 1) return true;
      deps.selectSegmentAt(ctx.selectedIdx + 1, "waveform", {
        shiftKey: mods.shiftKey,
      });
      return true;
    }
    case "waveform.seekFramePrev":
      wf.seekByDelta(-1 / 30);
      return true;
    case "waveform.seekFrameNext":
      wf.seekByDelta(1 / 30);
      return true;
    case "waveform.zoomIn":
      deps.stepWaveformZoom("in");
      return true;
    case "waveform.zoomOut":
      deps.stepWaveformZoom("out");
      return true;
    case "waveform.lowConfidencePrev":
      executeEditorLowConfidenceJump(deps, "prev");
      return true;
    case "waveform.lowConfidenceNext":
      executeEditorLowConfidenceJump(deps, "next");
      return true;
    default:
      return false;
  }
}

function executeEditorLowConfidenceJump(
  deps: EditorShortcutExecuteDeps,
  direction: "prev" | "next",
): void {
  const { ctx, selectSegmentAt, showEditorHint } = deps;
  const from = ctx.selectedIdx;
  let j = -1;
  if (direction === "prev") {
    for (let k = from - 1; k >= 0; k -= 1) {
      if (ctx.segments[k]?.low_confidence) {
        j = k;
        break;
      }
    }
    if (j < 0) {
      for (let k = ctx.segments.length - 1; k >= 0; k -= 1) {
        if (ctx.segments[k]?.low_confidence) {
          j = k;
          break;
        }
      }
    }
  } else {
    for (let k = from + 1; k < ctx.segments.length; k += 1) {
      if (ctx.segments[k]?.low_confidence) {
        j = k;
        break;
      }
    }
    if (j < 0) {
      for (let k = 0; k < ctx.segments.length; k += 1) {
        if (ctx.segments[k]?.low_confidence) {
          j = k;
          break;
        }
      }
    }
  }
  if (j >= 0) selectSegmentAt(j, "waveform");
  else showEditorHint("没有低置信度语段。");
}

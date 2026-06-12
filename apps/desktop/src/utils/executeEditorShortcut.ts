import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { useProjectWaveform } from "../hooks/useProjectWaveform";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import { readFocusedSegmentTextareaIdx, readFocusedTranscriptTextareaSelection } from "../pages/flushSegmentTextDrafts";
import type { EditorShortcutId } from "./editorShortcutRegistry";

type WfApi = ReturnType<typeof useProjectWaveform>;

export type EditorShortcutExecuteDeps = {
  ctx: TranscriptionLayerInput;
  wf: WfApi;
  selectSegmentAt: (idx: number, source?: SegmentSelectSource, opts?: { shiftKey?: boolean }) => void;
  focusSegmentTextarea: (segmentIdx: number) => void;
  showEditorHint: (msg: string) => void;
  stepWaveformZoom: (direction: "in" | "out") => void;
  blurActiveElement: () => void;
};

export type EditorShortcutExecuteMods = {
  shiftKey?: boolean;
  eventTarget?: EventTarget | null;
};

function resolveMergeAnchorIdx(ctx: TranscriptionLayerInput): number {
  const focusIdx = readFocusedSegmentTextareaIdx(ctx.segments.length);
  return focusIdx ?? ctx.selectedIdx;
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

  if (ctx.busy) return true;

  switch (id) {
    case "segment.mergeNext": {
      if (ctx.isMultiSegmentSelection && ctx.isContiguousSelection) {
        ctx.mergeSegmentRange(ctx.selectionLo, ctx.selectionHi);
        return true;
      }
      const idx = resolveMergeAnchorIdx(ctx);
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
      const idx = resolveMergeAnchorIdx(ctx);
      if (idx > 0) {
        ctx.mergeWithPrevAt(idx);
      }
      return true;
    }
    case "segment.splitPlayhead": {
      const idx = resolveMergeAnchorIdx(ctx);
      if (idx >= 0 && idx < ctx.segments.length) {
        ctx.splitAtPlayhead(wf.getPlayheadTime());
      }
      return true;
    }
    case "segment.focusText": {
      const idx = resolveMergeAnchorIdx(ctx);
      if (idx >= 0 && idx < ctx.segments.length) {
        deps.focusSegmentTextarea(idx);
      }
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
      const idx = resolveMergeAnchorIdx(ctx);
      if (idx < 0 || idx >= ctx.segments.length) return true;
      void (async () => {
        const ok = await ctx.confirmSegmentEditAndAdvance(idx);
        if (!ok) return;
        const ni = Math.min(idx + 1, Math.max(0, ctx.segments.length - 1));
        if (ni !== idx) {
          deps.selectSegmentAt(ni, "list");
          deps.focusSegmentTextarea(ni);
        }
      })();
      return true;
    }
    case "workflow.find":
      ctx.triggerFindReplaceShortcut();
      return true;
    case "workflow.closeFile":
      ctx.closeFile();
      return true;
    case "workflow.segmentAnnotation": {
      const idx = resolveMergeAnchorIdx(ctx);
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

export function executeEditorLowConfidenceJump(
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

import { useEffect, useRef } from "react";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { useProjectWaveform } from "./useProjectWaveform";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import { isFindReplacePanelOpen } from "../pages/findReplaceTypes";
import { isCorrectionRulesPanelOpen } from "../pages/correctionRulesPanelTypes";
import { TRANSCRIPT_TEXTAREA_SELECTOR } from "../pages/flushSegmentTextDrafts";
import {
  getEditorShortcutDefinition,
  matchEditorShortcut,
  type EditorShortcutId,
} from "../utils/editorShortcutRegistry";
import type { ConfirmAdvanceTabQueueRef } from "../utils/confirmAdvanceTabQueue";
import { executeEditorShortcut } from "../utils/executeEditorShortcut";
import { hasOpenDialogEscapeHandler } from "../utils/dialogEscapeStack";
import type { SegmentListFilterNavState } from "../utils/segmentListFilterNav";

type WfApi = ReturnType<typeof useProjectWaveform>;

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  const field = el.closest("textarea, input, select, [contenteditable='true'], [contenteditable='']");
  if (!field) return false;
  if (field instanceof HTMLInputElement) {
    const type = field.type.toLowerCase();
    if (
      type === "button" ||
      type === "submit" ||
      type === "reset" ||
      type === "checkbox" ||
      type === "radio" ||
      type === "file"
    ) {
      return false;
    }
  }
  return true;
}

function isTranscriptTextarea(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  return Boolean(el.closest(TRANSCRIPT_TEXTAREA_SELECTOR));
}

function isWaveformShellTarget(target: EventTarget | null, shell: HTMLElement | null): boolean {
  const el = target as Node | null;
  if (!el || !shell) return false;
  return shell.contains(el);
}

function isFloatingEditorPanelOpen(): boolean {
  return isFindReplacePanelOpen() || isCorrectionRulesPanelOpen();
}

function shortcutAllowedInGenericEditable(shortcutId: EditorShortcutId): boolean {
  return (
    shortcutId === "edit.undo" ||
    shortcutId === "edit.redo" ||
    shortcutId === "workflow.save" ||
    shortcutId === "workflow.confirmAdvance" ||
    shortcutId === "workflow.find" ||
    shortcutId === "workflow.openSettings" ||
    shortcutId === "workflow.openActivityInbox" ||
    shortcutId === "workflow.closeFile" ||
    shortcutId === "workflow.segmentAnnotation" ||
    shortcutId === "workflow.addCorrectionMemory" ||
    shortcutId === "segment.delete" ||
    shortcutId === "segment.advancePrev" ||
    shortcutId === "segment.advanceNext" ||
    shortcutId.startsWith("segment.")
  );
}

export function useEditorShortcutDispatcher(args: {
  enabled: boolean;
  ctxRef: React.MutableRefObject<TranscriptionLayerInput>;
  wfApiRef: React.MutableRefObject<WfApi>;
  waveformShellRef: React.RefObject<HTMLElement | null>;
  selectSegmentAtRef: React.MutableRefObject<
    (idx: number, source?: SegmentSelectSource, opts?: { shiftKey?: boolean }) => void
  >;
  focusSegmentTextarea: (segmentIdx: number) => void;
  scheduleAdvanceToSegmentRef: React.MutableRefObject<(targetIdx: number) => void>;
  showEditorHintRef: React.MutableRefObject<(msg: string) => void>;
  stepWaveformZoomRef: React.MutableRefObject<(direction: "in" | "out") => void>;
  segmentListFilterNavRef: React.MutableRefObject<SegmentListFilterNavState>;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;
  const confirmAdvanceQueueRef = useRef<ConfirmAdvanceTabQueueRef>({
    inFlight: false,
    pendingSteps: 0,
  });

  useEffect(() => {
    if (!args.enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;

      const inTextarea = isTranscriptTextarea(e.target);
      const shortcutId = matchEditorShortcut(e, { inTextarea });
      if (!shortcutId) return;

      if (shortcutId === "waveform.clearSelection" && hasOpenDialogEscapeHandler()) return;

      if (isFloatingEditorPanelOpen() && shortcutId !== "workflow.find" && shortcutId !== "workflow.openSettings" && shortcutId !== "workflow.openActivityInbox") {
        return;
      }

      const def = getEditorShortcutDefinition(shortcutId);
      const inWaveform = isWaveformShellTarget(e.target, argsRef.current.waveformShellRef.current);
      if (def.scope === "waveform" && !inWaveform) return;

      const a = argsRef.current;
      const ctx = a.ctxRef.current;
      if (def.requiresOpenFile !== false && !ctx.fileId) return;
      if (ctx.busy && shortcutId !== "workflow.openSettings" && shortcutId !== "workflow.openActivityInbox") return;

      if (
        !inTextarea &&
        isEditableKeyboardTarget(e.target) &&
        !shortcutAllowedInGenericEditable(shortcutId)
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      executeEditorShortcut(
        shortcutId,
        {
          ctx,
          getCtx: () => argsRef.current.ctxRef.current,
          wf: a.wfApiRef.current,
          selectSegmentAt: (idx, source, opts) => a.selectSegmentAtRef.current(idx, source, opts),
          focusSegmentTextarea: a.focusSegmentTextarea,
          scheduleAdvanceToSegment: (targetIdx) =>
            a.scheduleAdvanceToSegmentRef.current(targetIdx),
          segmentListFilterNavState: a.segmentListFilterNavRef.current,
          showEditorHint: (msg) => a.showEditorHintRef.current(msg),
          stepWaveformZoom: (dir) => a.stepWaveformZoomRef.current(dir),
          blurActiveElement: () => {
            (document.activeElement as HTMLElement | null)?.blur?.();
          },
          confirmAdvanceQueueRef: confirmAdvanceQueueRef.current,
        },
        { shiftKey: e.shiftKey, eventTarget: e.target },
      );
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [args.enabled]);
}

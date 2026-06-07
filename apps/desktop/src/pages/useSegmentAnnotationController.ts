import { flushSync } from "react-dom";
import { useCallback, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { normalizeSegmentAnnotationInput } from "../utils/segmentAnnotation";

export type SegmentAnnotationDialogState =
  | { phase: "closed" }
  | {
      phase: "edit";
      segmentIdx: number;
      draft: string;
      hadAnnotation: boolean;
    };

type Args = {
  busy: boolean;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  saveSegments: (options?: { quiet?: boolean; countHits?: boolean }) => Promise<boolean>;
  pushUndo: () => void;
  setError: (msg: string) => void;
};

export function useSegmentAnnotationController({
  busy,
  segmentsRef,
  setSegments,
  saveSegments,
  pushUndo,
  setError,
}: Args) {
  const [dialog, setDialog] = useState<SegmentAnnotationDialogState>({ phase: "closed" });
  const [saving, setSaving] = useState(false);
  const persistInFlightRef = useRef(false);

  const openSegmentAnnotationDialog = useCallback(
    (segmentIdx: number) => {
      const seg = segmentsRef.current[segmentIdx];
      if (!seg || busy) return;
      const existing = seg.annotation?.trim() ?? "";
      setError("");
      setDialog({
        phase: "edit",
        segmentIdx,
        draft: existing,
        hadAnnotation: existing.length > 0,
      });
    },
    [busy, segmentsRef, setError],
  );

  const closeSegmentAnnotationDialog = useCallback(() => {
    setDialog({ phase: "closed" });
  }, []);

  const setSegmentAnnotationDraft = useCallback((draft: string) => {
    setDialog((prev) => (prev.phase === "edit" ? { ...prev, draft } : prev));
  }, []);

  const persistAnnotation = useCallback(
    async (segmentIdx: number, raw: string) => {
      if (busy || persistInFlightRef.current) return false;
      const row = segmentsRef.current[segmentIdx];
      if (!row) return false;
      const prevAnnotation = row.annotation ?? null;
      const nextValue = normalizeSegmentAnnotationInput(raw);
      if ((prevAnnotation ?? null) === nextValue) {
        closeSegmentAnnotationDialog();
        return true;
      }
      persistInFlightRef.current = true;
      setSaving(true);
      try {
        pushUndo();
        const next = [...segmentsRef.current];
        next[segmentIdx] = { ...row, annotation: nextValue };
        flushSync(() => {
          segmentsRef.current = next;
          setSegments(next);
        });
        const saved = await saveSegments({ quiet: true, countHits: false });
        if (saved) {
          closeSegmentAnnotationDialog();
          return true;
        }
        const reverted = [...segmentsRef.current];
        const revertedRow = reverted[segmentIdx];
        if (revertedRow) {
          reverted[segmentIdx] = { ...revertedRow, annotation: prevAnnotation };
          flushSync(() => {
            segmentsRef.current = reverted;
            setSegments(reverted);
          });
        }
        setError("备注保存失败，请重试");
        return false;
      } finally {
        persistInFlightRef.current = false;
        setSaving(false);
      }
    },
    [busy, closeSegmentAnnotationDialog, pushUndo, saveSegments, segmentsRef, setError, setSegments],
  );

  const saveSegmentAnnotation = useCallback(() => {
    if (dialog.phase !== "edit" || busy) return Promise.resolve(false);
    return persistAnnotation(dialog.segmentIdx, dialog.draft);
  }, [busy, dialog, persistAnnotation]);

  const clearSegmentAnnotation = useCallback(() => {
    if (dialog.phase !== "edit" || busy) return Promise.resolve(false);
    return persistAnnotation(dialog.segmentIdx, "");
  }, [busy, dialog, persistAnnotation]);

  return {
    segmentAnnotationDialog: dialog,
    segmentAnnotationSaving: saving,
    openSegmentAnnotationDialog,
    closeSegmentAnnotationDialog,
    setSegmentAnnotationDraft,
    saveSegmentAnnotation,
    clearSegmentAnnotation,
  };
}

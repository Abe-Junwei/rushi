import { useCallback } from "react";
import { formatSrt, formatTxt, type ExportSegment } from "../services/exportFormatters";
import type { ProjectDetail, SegmentDto } from "../tauri/p1Api";
import * as p1 from "../tauri/p1Api";
import { p3ExportDocx, type P3DocxExportMode } from "../tauri/p3ExportDocxApi";
import { p4ExportDiagnosticBundle } from "../tauri/p4DiagnosticApi";
import { safeExportBasename } from "../utils/safeExportBasename";

export interface P1ExportApi {
  exportTxt: () => Promise<void>;
  exportSrt: () => Promise<void>;
  exportDocx: (mode: P3DocxExportMode) => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
}

export interface P1ExportDeps {
  current: ProjectDetail | null;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setError: (msg: string) => void;
  flushP1SegmentTextDraftsFromDom: () => void;
}

export function useP1ExportController(deps: P1ExportDeps): P1ExportApi {
  const { current, segmentsRef, setError, flushP1SegmentTextDraftsFromDom } = deps;

  const exportTxt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushP1SegmentTextDraftsFromDom();
    const rows: ExportSegment[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.p1ExportTextFile(safeExportBasename(current.name, "txt"), formatTxt(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, segmentsRef, setError, flushP1SegmentTextDraftsFromDom]);

  const exportSrt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushP1SegmentTextDraftsFromDom();
    const rows: ExportSegment[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.p1ExportTextFile(safeExportBasename(current.name, "srt"), formatSrt(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, segmentsRef, setError, flushP1SegmentTextDraftsFromDom]);

  const exportDocx = useCallback(
    async (mode: P3DocxExportMode) => {
      if (!current) return;
      setError("");
      flushP1SegmentTextDraftsFromDom();
      const normalized: SegmentDto[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
      try {
        await p3ExportDocx(safeExportBasename(current.name, "docx"), current.name, mode, normalized);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [current, segmentsRef, setError, flushP1SegmentTextDraftsFromDom],
  );

  const exportDiagnosticBundle = useCallback(async () => {
    setError("");
    try {
      await p4ExportDiagnosticBundle();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [setError]);

  return { exportTxt, exportSrt, exportDocx, exportDiagnosticBundle };
}

import { useCallback } from "react";
import { formatSrt, formatTxt, type ExportSegment } from "../services/exportFormatters";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { exportDocx as exportDocxImpl, type DocxExportMode } from "../tauri/exportDocxApi";
import { exportDiagnosticBundle as exportDiagnosticBundleImpl } from "../tauri/diagnosticApi";
import { safeExportBasename } from "../utils/safeExportBasename";

export interface ExportApi {
  exportTxt: () => Promise<void>;
  exportSrt: () => Promise<void>;
  exportDocx: (mode: DocxExportMode) => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
}

export interface ExportDeps {
  current: ProjectDetail | null;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setError: (msg: string) => void;
  flushSegmentTextDraftsFromDom: () => void;
}

export function useExportController(deps: ExportDeps): ExportApi {
  const { current, segmentsRef, setError, flushSegmentTextDraftsFromDom } = deps;

  const exportTxt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushSegmentTextDraftsFromDom();
    const rows: ExportSegment[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.exportTextFile(safeExportBasename(current.name, "txt"), formatTxt(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, segmentsRef, setError, flushSegmentTextDraftsFromDom]);

  const exportSrt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushSegmentTextDraftsFromDom();
    const rows: ExportSegment[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.exportTextFile(safeExportBasename(current.name, "srt"), formatSrt(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, segmentsRef, setError, flushSegmentTextDraftsFromDom]);

  const exportDocx = useCallback(
    async (mode: DocxExportMode) => {
      if (!current) return;
      setError("");
      flushSegmentTextDraftsFromDom();
      const normalized: SegmentDto[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
      try {
        await exportDocxImpl(safeExportBasename(current.name, "docx"), current.name, mode, normalized);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [current, segmentsRef, setError, flushSegmentTextDraftsFromDom],
  );

  const exportDiagnosticBundle = useCallback(async () => {
    setError("");
    try {
      await exportDiagnosticBundleImpl();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [setError]);

  return { exportTxt, exportSrt, exportDocx, exportDiagnosticBundle };
}

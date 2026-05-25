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
  exportProjectBundle: () => Promise<void>;
  importProjectBundle: () => Promise<void>;
}

export interface ExportDeps {
  current: ProjectDetail | null;
  currentFileId: string | null;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setError: (msg: string) => void;
  flushSegmentTextDrafts: () => void;
  refreshProjects: () => Promise<void>;
  applyDetail: (d: ProjectDetail) => void;
}

export function useExportController(deps: ExportDeps): ExportApi {
  const {
    current,
    currentFileId,
    segmentsRef,
    setError,
    flushSegmentTextDrafts,
    refreshProjects,
    applyDetail,
  } = deps;

  const exportTxt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushSegmentTextDrafts();
    const rows: ExportSegment[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.exportTextFile(safeExportBasename(current.name, "txt"), formatTxt(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, segmentsRef, setError, flushSegmentTextDrafts]);

  const exportSrt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushSegmentTextDrafts();
    const rows: ExportSegment[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.exportTextFile(safeExportBasename(current.name, "srt"), formatSrt(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, segmentsRef, setError, flushSegmentTextDrafts]);

  const exportDocx = useCallback(
    async (mode: DocxExportMode) => {
      if (!current) return;
      setError("");
      flushSegmentTextDrafts();
      const normalized: SegmentDto[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
      try {
        await exportDocxImpl(safeExportBasename(current.name, "docx"), current.name, mode, normalized);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [current, segmentsRef, setError, flushSegmentTextDrafts],
  );

  const exportDiagnosticBundle = useCallback(async () => {
    setError("");
    try {
      await exportDiagnosticBundleImpl();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [setError]);

  const exportProjectBundle = useCallback(async () => {
    if (!current || !currentFileId) {
      if (current && !currentFileId) {
        setError("请先打开一个文件后再导出项目包");
      }
      return;
    }
    setError("");
    flushSegmentTextDrafts();
    const normalized: SegmentDto[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.exportProjectBundle(
        current.id,
        currentFileId,
        safeExportBasename(current.name, "zip"),
        normalized,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, currentFileId, segmentsRef, setError, flushSegmentTextDrafts]);

  const importProjectBundle = useCallback(async () => {
    setError("");
    try {
      const detail = await p1.importProjectBundle();
      if (!detail) return;
      applyDetail(detail);
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [applyDetail, refreshProjects, setError]);

  return { exportTxt, exportSrt, exportDocx, exportDiagnosticBundle, exportProjectBundle, importProjectBundle };
}

import { useCallback } from "react";
import { formatSrt, formatTxt, type ExportSegment } from "../services/exportFormatters";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { exportDocx as exportDocxImpl, type DocxExportMode } from "../tauri/exportDocxApi";
import {
  buildDeliveryExportAppendixLines,
  buildDocxExportMetaLine,
} from "../services/exportDeliveryAppendix";
import {
  exportModeSupportsLlmPolish,
  type ExportPolishResult,
  resolveExportPolishForDelivery,
} from "../services/exportDocxPolish";
import { joinSegmentTextsForExportPolish } from "../services/exportDocxPolish.helpers";
import { assessExportPolishReadiness } from "../services/exportPolishDelivery";
import {
  buildExportPolishEditLogDetail,
  buildExportPolishRevisionLines,
} from "../services/exportPolishRevision";
import { exportDiagnosticBundle as exportDiagnosticBundleImpl } from "../tauri/diagnosticApi";
import { safeExportBasename } from "../utils/safeExportBasename";
import type { BusyReason } from "./useProjectCrudController";

export type DeliveryDocxExportRequest = {
  mode: DocxExportMode;
  includeRevisionAppendix: boolean;
  /** 讲稿/干净稿：导出前 LLM 润色（纠错字、标点、语义分段）。 */
  llmPolish?: boolean;
  /** 交付导出对话框「生成预览」结果；与当前语段一致时复用，不再请求 LLM。 */
  polishPreview?: ExportPolishResult | null;
};

export interface ExportApi {
  exportTxt: () => Promise<void>;
  exportSrt: () => Promise<void>;
  exportDocx: (mode: DocxExportMode) => Promise<void>;
  exportDeliveryDocx: (request: DeliveryDocxExportRequest) => Promise<void>;
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
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
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
    beginBusy,
    endBusy,
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
        await exportDocxImpl(safeExportBasename(current.name, "docx"), current.name, mode, normalized, {
          exportMetaLine: buildDocxExportMetaLine(current.name),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [current, segmentsRef, setError, flushSegmentTextDrafts],
  );

  const exportDeliveryDocx = useCallback(
    async (request: DeliveryDocxExportRequest) => {
      if (!current) return;
      setError("");
      flushSegmentTextDrafts();
      const normalized: SegmentDto[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
      beginBusy("export");
      try {
        let appendixLines: string[] = [];
        if (request.includeRevisionAppendix && currentFileId) {
          try {
            const rows = await p1.projectListEditLog(current.id, 50);
            appendixLines = buildDeliveryExportAppendixLines(rows, currentFileId);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return;
          }
        }
        const segmentTexts = normalized.map((s) => s.text ?? "");
        let polishedParagraphs: string[] | undefined;
        let polishCorrectedLines: string[] | undefined;
        const polishBeforeJoined =
          request.llmPolish && exportModeSupportsLlmPolish(request.mode)
            ? joinSegmentTextsForExportPolish(normalized)
            : undefined;
        if (request.llmPolish && exportModeSupportsLlmPolish(request.mode)) {
          const readiness = assessExportPolishReadiness(
            normalized,
            request.mode,
            true,
            request.polishPreview ?? null,
          );
          if (!readiness.canExport) {
            setError(readiness.blockReason ?? "请先完成润色预览。");
            return;
          }
          try {
            const polish = await resolveExportPolishForDelivery(
              normalized,
              request.polishPreview,
            );
            polishedParagraphs = polish.paragraphs;
            polishCorrectedLines =
              polish.correctedLines.length > 0 ? polish.correctedLines : undefined;
            if (request.includeRevisionAppendix && polishedParagraphs.length > 0) {
              const polishLines = buildExportPolishRevisionLines(
                segmentTexts,
                polishedParagraphs,
              );
              if (polishLines.length > 0) {
                if (appendixLines.length > 0) appendixLines.push("");
                appendixLines.push("— 本次导出大模型润色 —");
                appendixLines.push(...polishLines);
              }
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return;
          }
        }
        await exportDocxImpl(
          safeExportBasename(current.name, "docx"),
          current.name,
          request.mode,
          normalized,
          {
            exportMetaLine: buildDocxExportMetaLine(current.name),
            appendixLines,
            polishedParagraphs,
            polishBeforeJoined:
              polishedParagraphs != null ? polishBeforeJoined : undefined,
            polishCorrectedLines:
              polishedParagraphs != null ? polishCorrectedLines : undefined,
            polishTrackChanges:
              polishedParagraphs != null && polishCorrectedLines != null
                ? true
                : undefined,
          },
        );
        if (
          request.llmPolish &&
          exportModeSupportsLlmPolish(request.mode) &&
          polishedParagraphs != null &&
          currentFileId
        ) {
          try {
            const detail = buildExportPolishEditLogDetail(
              currentFileId,
              segmentTexts,
              polishedParagraphs,
            );
            await p1.projectRecordEditLog(
              current.id,
              "export_llm_polish",
              JSON.stringify(detail),
            );
          } catch {
            /* 审计写入失败不阻断导出 */
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        endBusy();
      }
    },
    [
      current,
      currentFileId,
      segmentsRef,
      setError,
      flushSegmentTextDrafts,
      beginBusy,
      endBusy,
    ],
  );

  const exportDiagnosticBundle = useCallback(async () => {
    const proceed = window.confirm(
      "诊断包将包含脱敏后的数据库副本与日志（语段正文、项目名称等已替换为 [REDACTED]）。仍可能含路径与操作元数据，仅分享给可信对象。确定继续导出？",
    );
    if (!proceed) return;
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

  return {
    exportTxt,
    exportSrt,
    exportDocx,
    exportDeliveryDocx,
    exportDiagnosticBundle,
    exportProjectBundle,
    importProjectBundle,
  };
}

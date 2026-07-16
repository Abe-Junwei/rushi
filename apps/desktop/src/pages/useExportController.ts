import { useCallback } from "react";
import { formatSrt, formatTxt, type ExportSegment } from "../services/exportFormatters";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { exportDocx as exportDocxImpl, type DocxExportMode } from "../tauri/exportDocxApi";
import { buildDocxExportMetaLine } from "../services/exportDeliveryAppendix";
import { buildDocxExportLayoutOptions } from "../services/exportDocxLayoutOptions";
import {
  mergeExportPolishBreaksWithBlockBoundaries,
  resolveDocxDeliveryTimeBlocks,
  resolvePolishParagraphCountsPerBlock,
} from "../utils/exportDocxDeliveryBlocks";
import { buildParagraphsFromBreaks } from "../services/exportPolishParagraphs";
import { planDeliveryDocxExport } from "../services/exportDeliveryPlan";
import { exportDiagnosticBundle as exportDiagnosticBundleImpl } from "../tauri/diagnosticApi";
import {
  exportWantsLlmPolish,
  fetchExportPolishResult,
  resolveExportPolishBlockReason,
  type ExportPolishResult,
} from "../services/exportDocxPolish";
import {
  safeExportBasename,
  docxExportBasename,
  formatRecordingFileNameForExport,
} from "../utils/safeExportBasename";
import { toast } from "../services/ui/toast";
import { pushExportFailureActivity } from "../services/ui/pushActivity";
import { syncOnboardingExport } from "../services/onboarding/onboardingAutoSync";
import type { BusyReason } from "./useProjectCrudController";
import { segmentsForDeliveryExport } from "../utils/frozenPlaybackSkip";

export type DeliveryDocxExportRequest = {
  mode: DocxExportMode;
  includeRevisionAppendix: boolean;
  /** 封面抬头附带讲述人/时间/地点/主题/转录人（Hub「项目信息」）。 */
  includeProjectMetadata?: boolean;
  /** 讲稿/干净稿：导出时 LLM 纠错（错别字、错误标点、语义分段）。 */
  llmPolish?: boolean;
  /** 控制器在导出前拉取的润色结果（勾选润色时必填）。 */
  polishResult?: ExportPolishResult | null;
};

export interface ExportApi {
  exportTxt: () => Promise<void>;
  exportSrt: () => Promise<void>;
  exportDeliveryDocx: (request: DeliveryDocxExportRequest) => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  exportProjectBundle: () => Promise<void>;
  importProjectBundle: () => Promise<void>;
}

export interface ExportDeps {
  current: ProjectDetail | null;
  currentFileId: string | null;
  /** 当前打开文件的真实音频路径；用于 DOCX 文末「录音文件名」。 */
  audioStoragePath: string | null;
  getCurrentSegmentsSnapshot: () => SegmentDto[];
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
    audioStoragePath,
    getCurrentSegmentsSnapshot,
    setError,
    flushSegmentTextDrafts,
    beginBusy,
    endBusy,
    refreshProjects,
    applyDetail,
  } = deps;

  const exportContextLabel = useCallback(() => {
    if (!current) return "";
    if (!currentFileId) return current.name;
    const file = current.files?.find((row) => row.id === currentFileId);
    return file?.name?.trim() || current.name;
  }, [current, currentFileId]);

  const exportDefaultBasename = useCallback(
    (ext: "txt" | "srt" | "docx" | "zip") => safeExportBasename(exportContextLabel(), ext),
    [exportContextLabel],
  );

  /** DOCX 文末「录音文件名」：显示名为主；磁盘存储名不同时括号备注（常见 `{uuid}.wav`）。 */
  const recordingFileName = useCallback(
    () => formatRecordingFileNameForExport(exportContextLabel(), audioStoragePath),
    [audioStoragePath, exportContextLabel],
  );

  const reportExportFailure = useCallback(
    (formatLabel: string, e: unknown) => {
      if (!current) return;
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      pushExportFailureActivity({
        formatLabel,
        errorMessage,
        projectId: current.id,
        fileId: currentFileId,
        fileLabel: exportContextLabel(),
      });
    },
    [current, currentFileId, exportContextLabel, setError],
  );

  const exportTxt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushSegmentTextDrafts();
    const rows: ExportSegment[] = segmentsForDeliveryExport(
      getCurrentSegmentsSnapshot().map((s, i) => ({ ...s, idx: i })),
    );
    try {
      await p1.exportTextFile(exportDefaultBasename("txt"), formatTxt(rows));
      syncOnboardingExport();
    } catch (e) {
      reportExportFailure("TXT", e);
    }
  }, [current, exportDefaultBasename, getCurrentSegmentsSnapshot, reportExportFailure, flushSegmentTextDrafts, setError]);

  const exportSrt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushSegmentTextDrafts();
    const rows: ExportSegment[] = segmentsForDeliveryExport(
      getCurrentSegmentsSnapshot().map((s, i) => ({ ...s, idx: i })),
    );
    try {
      await p1.exportTextFile(exportDefaultBasename("srt"), formatSrt(rows));
      syncOnboardingExport();
    } catch (e) {
      reportExportFailure("SRT", e);
    }
  }, [current, exportDefaultBasename, getCurrentSegmentsSnapshot, reportExportFailure, flushSegmentTextDrafts, setError]);

  const docxExportMetaLine = useCallback(
    (includeProjectMetadata: boolean) => {
      if (!current) return undefined;
      return buildDocxExportMetaLine(exportContextLabel(), new Date(), {
        includeProjectMetadata,
        metadata: {
          narrator: current.narrator,
          recorded_at: current.recorded_at,
          location: current.location,
          subject: current.subject,
          transcriber: current.transcriber,
        },
      });
    },
    [current, exportContextLabel],
  );

  const exportDeliveryDocx = useCallback(
    async (request: DeliveryDocxExportRequest) => {
      if (!current) return;
      setError("");
      flushSegmentTextDrafts();
      const allSegments = getCurrentSegmentsSnapshot().map((s, i) => ({ ...s, idx: i }));
      const normalized: SegmentDto[] = segmentsForDeliveryExport(allSegments);
      const wantsPolish = exportWantsLlmPolish(request.mode, Boolean(request.llmPolish));
      beginBusy(wantsPolish ? "export_polish" : "export");
      try {
        let editLogRows: Awaited<ReturnType<typeof p1.projectListEditLog>> = [];
        if (request.includeRevisionAppendix && currentFileId) {
          try {
            editLogRows = await p1.projectListEditLog(current.id, 50);
          } catch (e) {
            reportExportFailure("交付 DOCX", e);
            return;
          }
        }
        let polishResult: ExportPolishResult | null = null;
        if (wantsPolish) {
          const block = resolveExportPolishBlockReason(normalized);
          if (block) {
            setError(block);
            pushExportFailureActivity({
              formatLabel: "交付 DOCX",
              errorMessage: block,
              projectId: current.id,
              fileId: currentFileId,
              fileLabel: exportContextLabel(),
            });
            return;
          }
          try {
            polishResult = await fetchExportPolishResult(normalized);
          } catch (e) {
            reportExportFailure("交付 DOCX", e);
            return;
          }
        }
        const plan = planDeliveryDocxExport({
          request: { ...request, polishResult },
          segments: normalized,
          editLogRows,
          currentFileId,
          exportMetaLine: docxExportMetaLine(Boolean(request.includeProjectMetadata)),
        });
        if (!plan.ok) {
          setError(plan.error);
          pushExportFailureActivity({
            formatLabel: "交付 DOCX",
            errorMessage: plan.error,
            projectId: current.id,
            fileId: currentFileId,
            fileLabel: exportContextLabel(),
          });
          return;
        }
        const hasPolish = Boolean(wantsPolish && plan.ok && plan.docxOptions.polishedParagraphs != null);
        const deliveryBlocks = resolveDocxDeliveryTimeBlocks(allSegments);
        let docxOptions = plan.docxOptions;
        let polishBlockUnitCounts: number[] | null = null;
        if (hasPolish && plan.ok && docxOptions.polishedParagraphs && docxOptions.polishCorrectedLines) {
          const correctedLines = docxOptions.polishCorrectedLines;
          const blockBreaks = mergeExportPolishBreaksWithBlockBoundaries(
            correctedLines.length,
            polishResult?.breakAfterLine ?? [],
            deliveryBlocks,
          );
          const paragraphs = buildParagraphsFromBreaks(correctedLines, blockBreaks);
          polishBlockUnitCounts = resolvePolishParagraphCountsPerBlock(
            paragraphs.length,
            correctedLines.length,
            blockBreaks,
            deliveryBlocks,
          );
          docxOptions = {
            ...docxOptions,
            polishedParagraphs: paragraphs,
          };
        }
        const layout = buildDocxExportLayoutOptions({
          mode: request.mode,
          segments: normalized,
          allSegments,
          recordingFileName: recordingFileName(),
          transcriber: current.transcriber,
          includeProjectMetadata: Boolean(request.includeProjectMetadata),
          polishBlockUnitCounts,
          exportedAt: new Date(),
        });
        await exportDocxImpl(
          docxExportBasename(exportContextLabel(), request.mode),
          exportContextLabel(),
          request.mode,
          normalized,
          { ...docxOptions, ...layout },
        );
        if (plan.recordEditLog.kind === "export_llm_polish") {
          try {
            await p1.projectRecordEditLog(
              current.id,
              "export_llm_polish",
              JSON.stringify(plan.recordEditLog.detail),
            );
          } catch {
            /* 审计写入失败不阻断导出 */
          }
        }
        syncOnboardingExport();
      } catch (e) {
        reportExportFailure("交付 DOCX", e);
      } finally {
        endBusy();
      }
    },
    [
      current,
      currentFileId,
      docxExportMetaLine,
      getCurrentSegmentsSnapshot,
      reportExportFailure,
      exportContextLabel,
      recordingFileName,
      exportDefaultBasename,
      flushSegmentTextDrafts,
      beginBusy,
      endBusy,
      setError,
    ],
  );

  const exportDiagnosticBundle = useCallback(async () => {
    setError("");
    try {
      const out = await exportDiagnosticBundleImpl();
      if (out) {
        toast.success(
          `已导出诊断包（语段正文等已脱敏）：${out}`,
        );
      } else {
        toast.info("已取消导出诊断包");
      }
    } catch (e) {
      toast.errorFromUnknown(e);
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
    const normalized: SegmentDto[] = getCurrentSegmentsSnapshot().map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.exportProjectBundle(
        current.id,
        currentFileId,
        exportDefaultBasename("zip"),
        normalized,
      );
      syncOnboardingExport();
    } catch (e) {
      reportExportFailure("项目包", e);
    }
  }, [current, currentFileId, exportDefaultBasename, getCurrentSegmentsSnapshot, reportExportFailure, flushSegmentTextDrafts, setError]);

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
    exportDeliveryDocx,
    exportDiagnosticBundle,
    exportProjectBundle,
    importProjectBundle,
  };
}

import { useCallback } from "react";
import { formatSrt, formatTxt, type ExportSegment } from "../services/exportFormatters";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { exportDocx as exportDocxImpl, type DocxExportMode } from "../tauri/exportDocxApi";
import { buildDocxExportMetaLine } from "../services/exportDeliveryAppendix";
import { planDeliveryDocxExport } from "../services/exportDeliveryPlan";
import { exportDiagnosticBundle as exportDiagnosticBundleImpl } from "../tauri/diagnosticApi";
import type { ExportPolishResult } from "../services/exportDocxPolish";
import { safeExportBasename } from "../utils/safeExportBasename";
import { toast } from "../services/ui/toast";
import { pushExportFailureActivity } from "../services/ui/pushActivity";
import { syncOnboardingExport } from "../services/onboarding/onboardingAutoSync";
import type { BusyReason } from "./useProjectCrudController";

export type DeliveryDocxExportRequest = {
  mode: DocxExportMode;
  includeRevisionAppendix: boolean;
  /** 封面抬头附带讲述人/时间/地点/主题/转录人（Hub「项目信息」）。 */
  includeProjectMetadata?: boolean;
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
    const rows: ExportSegment[] = getCurrentSegmentsSnapshot().map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.exportTextFile(safeExportBasename(current.name, "txt"), formatTxt(rows));
      syncOnboardingExport();
    } catch (e) {
      reportExportFailure("TXT", e);
    }
  }, [current, getCurrentSegmentsSnapshot, reportExportFailure, flushSegmentTextDrafts, setError]);

  const exportSrt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushSegmentTextDrafts();
    const rows: ExportSegment[] = getCurrentSegmentsSnapshot().map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.exportTextFile(safeExportBasename(current.name, "srt"), formatSrt(rows));
      syncOnboardingExport();
    } catch (e) {
      reportExportFailure("SRT", e);
    }
  }, [current, getCurrentSegmentsSnapshot, reportExportFailure, flushSegmentTextDrafts, setError]);

  const docxExportMetaLine = useCallback(
    (includeProjectMetadata: boolean) => {
      if (!current) return undefined;
      return buildDocxExportMetaLine(current.name, new Date(), {
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
    [current],
  );

  const exportDocx = useCallback(
    async (mode: DocxExportMode) => {
      if (!current) return;
      setError("");
      flushSegmentTextDrafts();
      const normalized: SegmentDto[] = getCurrentSegmentsSnapshot().map((s, i) => ({ ...s, idx: i }));
      try {
        await exportDocxImpl(safeExportBasename(current.name, "docx"), current.name, mode, normalized, {
          exportMetaLine: docxExportMetaLine(false),
        });
        syncOnboardingExport();
      } catch (e) {
        reportExportFailure("DOCX", e);
      }
    },
    [current, docxExportMetaLine, getCurrentSegmentsSnapshot, reportExportFailure, flushSegmentTextDrafts, setError],
  );

  const exportDeliveryDocx = useCallback(
    async (request: DeliveryDocxExportRequest) => {
      if (!current) return;
      setError("");
      flushSegmentTextDrafts();
      const normalized: SegmentDto[] = getCurrentSegmentsSnapshot().map((s, i) => ({ ...s, idx: i }));
      beginBusy("export");
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
        const plan = planDeliveryDocxExport({
          request,
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
        await exportDocxImpl(
          safeExportBasename(current.name, "docx"),
          current.name,
          request.mode,
          normalized,
          plan.docxOptions,
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
        safeExportBasename(current.name, "zip"),
        normalized,
      );
      syncOnboardingExport();
    } catch (e) {
      reportExportFailure("项目包", e);
    }
  }, [current, currentFileId, getCurrentSegmentsSnapshot, reportExportFailure, flushSegmentTextDrafts, setError]);

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

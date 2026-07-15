import type { EditLogEntryDto, SegmentDto } from "../tauri/projectApi";
import { buildDeliveryExportAppendixLines } from "./exportDeliveryAppendix";
import {
  exportModeRequiresLlmPolish,
  exportWantsLlmPolish,
  resolveExportPolishForDelivery,
  type ExportPolishResult,
} from "./exportDocxPolish";
import type { DocxExportMode } from "../tauri/exportDocxApi";
import { readLlmRuntimeConfigFromStorage } from "./postprocess/postprocessRuntimeContract";
import { joinSegmentTextsForExportPolish } from "./exportDocxPolish.helpers";
import { assessExportPolishReadiness } from "./exportPolishDelivery";
import {
  buildExportPolishEditLogDetail,
  buildExportPolishRevisionLines,
} from "./exportPolishRevision";
import type { DeliveryDocxExportRequest } from "../pages/useExportController";

export type DeliveryDocxExportPlanInput = {
  request: DeliveryDocxExportRequest;
  segments: SegmentDto[];
  editLogRows: EditLogEntryDto[];
  currentFileId: string | null;
  exportMetaLine: string | undefined;
};

export type DeliveryDocxExportPlan =
  | { ok: false; error: string }
  | {
      ok: true;
      docxOptions: {
        exportMetaLine: string | undefined;
        appendixLines: string[];
        polishedParagraphs?: string[];
        polishBeforeJoined?: string;
        polishCorrectedLines?: string[];
        polishTrackChanges?: boolean;
        polishTrackAuthor?: string;
      };
      recordEditLog:
        | { kind: "none" }
        | { kind: "export_llm_polish"; detail: ReturnType<typeof buildExportPolishEditLogDetail> };
    };

/** 干净稿 Word 修订轨作者：当前 LLM 模型名。 */
function resolveCleanDocxPolishTrackAuthor(mode: DocxExportMode): string | undefined {
  if (mode !== "clean") return undefined;
  const model = readLlmRuntimeConfigFromStorage().model.trim();
  return model || undefined;
}

/** Delivery DOCX 编排真源：appendix + LLM polish + 修订轨决策（不含 IO）。 */
export function planDeliveryDocxExport(input: DeliveryDocxExportPlanInput): DeliveryDocxExportPlan {
  const { request, segments, editLogRows, currentFileId, exportMetaLine } = input;
  const segmentTexts = segments.map((s) => s.text ?? "");

  let appendixLines: string[] = [];
  if (request.includeRevisionAppendix && currentFileId) {
    appendixLines = buildDeliveryExportAppendixLines(editLogRows, currentFileId);
  }

  const wantsPolish = exportWantsLlmPolish(request.mode, Boolean(request.llmPolish));
  if (exportModeRequiresLlmPolish(request.mode) && !wantsPolish) {
    return { ok: false, error: "干净稿导出须走大模型润色。" };
  }
  let polishedParagraphs: string[] | undefined;
  let polishCorrectedLines: string[] | undefined;
  const polishBeforeJoined = wantsPolish
    ? joinSegmentTextsForExportPolish(segments)
    : undefined;

  if (wantsPolish) {
    const readiness = assessExportPolishReadiness(segments, request.mode, true);
    if (!readiness.canExport) {
      return { ok: false, error: readiness.blockReason ?? "大模型润色不可用。" };
    }
    if (!request.polishResult) {
      return { ok: false, error: "缺少润色结果，请重试导出。" };
    }
    try {
      const polish = resolveExportPolishForDelivery(segments, request.polishResult);
      polishedParagraphs = polish.paragraphs;
      polishCorrectedLines =
        polish.correctedLines.length > 0 ? polish.correctedLines : undefined;
      if (request.includeRevisionAppendix && polishedParagraphs.length > 0) {
        const polishLines = buildExportPolishRevisionLines(segmentTexts, polishedParagraphs);
        if (polishLines.length > 0) {
          if (appendixLines.length > 0) appendixLines.push("");
          appendixLines.push("— 本次导出大模型润色 —");
          appendixLines.push(...polishLines);
        }
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const recordEditLog =
    wantsPolish && polishedParagraphs != null && currentFileId
      ? {
          kind: "export_llm_polish" as const,
          detail: buildExportPolishEditLogDetail(
            currentFileId,
            segmentTexts,
            polishedParagraphs,
          ),
        }
      : { kind: "none" as const };

  return {
    ok: true,
    docxOptions: {
      exportMetaLine,
      appendixLines,
      polishedParagraphs,
      polishBeforeJoined: polishedParagraphs != null ? polishBeforeJoined : undefined,
      polishCorrectedLines: polishedParagraphs != null ? polishCorrectedLines : undefined,
      polishTrackChanges:
        polishedParagraphs != null && polishCorrectedLines != null ? true : undefined,
      polishTrackAuthor:
        polishedParagraphs != null && polishCorrectedLines != null
          ? resolveCleanDocxPolishTrackAuthor(request.mode)
          : undefined,
    },
    recordEditLog,
  };
}

export type { ExportPolishResult };

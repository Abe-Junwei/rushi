import { invoke } from "@tauri-apps/api/core";
import type { QualityEvalReport } from "../services/quality/qualityEvalReport";

export type QualityEvalRunResult = {
  report: QualityEvalReport;
  hadErrors: boolean;
  reportPath: string;
};

export async function qualityGetLastReport(): Promise<QualityEvalReport | null> {
  return invoke<QualityEvalReport | null>("quality_get_last_report");
}

export async function qualityGetBaselineReport(): Promise<QualityEvalReport | null> {
  return invoke<QualityEvalReport | null>("quality_get_baseline_report");
}

export async function qualityRunEval(args?: {
  filterId?: string;
  hotwordsMode?: "manifest" | "on" | "off";
}): Promise<QualityEvalRunResult> {
  return invoke<QualityEvalRunResult>("quality_run_eval", {
    args: args
      ? {
          filterId: args.filterId ?? null,
          hotwordsMode: args.hotwordsMode ?? "manifest",
        }
      : null,
  });
}

export async function qualityImportReportFile(): Promise<QualityEvalReport | null> {
  return invoke<QualityEvalReport | null>("quality_import_report_file");
}

export async function qualitySetBaselineFromLast(): Promise<void> {
  return invoke("quality_set_baseline_from_last");
}

export async function qualityLastReportPath(): Promise<string> {
  return invoke<string>("quality_last_report_path_cmd");
}

export async function qualityExportCorrectionMemoryJsonl(
  redactText: boolean,
): Promise<string | null> {
  return invoke<string | null>("quality_export_correction_memory_jsonl", { redactText });
}

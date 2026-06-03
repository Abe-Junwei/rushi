export type QualityEvalReportItem = {
  id: string;
  category?: string;
  cerChars?: number | null;
  termHitRate?: number | null;
  lowConfidenceRatio?: number | null;
  engine?: string;
  error?: string;
  skipped?: string;
};

export type QualityEvalReport = {
  schemaVersion: string;
  manifest: string;
  asrBase: string;
  hotwordsMode?: string;
  hotwordsAb?: boolean;
  filterId?: string | null;
  finishedAtMs?: number;
  exitCode?: number;
  items: QualityEvalReportItem[];
};

export type QualityEvalSummary = {
  itemCount: number;
  errorCount: number;
  skippedCount: number;
  meanCer: number | null;
  meanTermHit: number | null;
  gateItemId: string;
  gateTermHit: number | null;
  gateCer: number | null;
};

export type QualityEvalDelta = {
  meanCerDelta: number | null;
  gateTermHitDelta: number | null;
};

const GATE_ITEM_ID = "proper-noun-zhikong";

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function summarizeQualityReport(report: QualityEvalReport): QualityEvalSummary {
  const items = report.items ?? [];
  let cerSum = 0;
  let cerN = 0;
  let hitSum = 0;
  let hitN = 0;
  let errorCount = 0;
  let skippedCount = 0;
  let gateTermHit: number | null = null;
  let gateCer: number | null = null;

  for (const it of items) {
    if (it.error) errorCount += 1;
    if (it.skipped) skippedCount += 1;
    const cer = num(it.cerChars);
    if (cer != null) {
      cerSum += cer;
      cerN += 1;
    }
    const hit = num(it.termHitRate);
    if (hit != null) {
      hitSum += hit;
      hitN += 1;
    }
    if (it.id === GATE_ITEM_ID) {
      gateTermHit = hit;
      gateCer = cer;
    }
  }

  return {
    itemCount: items.length,
    errorCount,
    skippedCount,
    meanCer: cerN > 0 ? cerSum / cerN : null,
    meanTermHit: hitN > 0 ? hitSum / hitN : null,
    gateItemId: GATE_ITEM_ID,
    gateTermHit,
    gateCer,
  };
}

export function compareQualityReports(
  current: QualityEvalReport,
  baseline: QualityEvalReport | null,
): QualityEvalDelta | null {
  if (!baseline) return null;
  const cur = summarizeQualityReport(current);
  const base = summarizeQualityReport(baseline);
  return {
    meanCerDelta:
      cur.meanCer != null && base.meanCer != null ? cur.meanCer - base.meanCer : null,
    gateTermHitDelta:
      cur.gateTermHit != null && base.gateTermHit != null
        ? cur.gateTermHit - base.gateTermHit
        : null,
  };
}

export function formatQualityPct(rate: number | null): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatQualityCer(cer: number | null): string {
  if (cer == null) return "—";
  return cer.toFixed(4);
}

export function formatFinishedAt(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}

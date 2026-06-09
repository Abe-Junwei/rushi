import { CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { ExportPolishResult } from "../services/exportDocxPolish";
import { buildExportPolishPreviewNotes } from "../services/exportPolishDelivery";
import { summarizeLineChange } from "../services/exportPolishPipeline";
import type { LlmEnvPresentation } from "../services/llm/llmEnvStatus";

const PREVIEW_MAX_ROWS = 10;

type Props = {
  llmEnv: LlmEnvPresentation;
  canPreviewPolish: boolean;
  previewLoading: boolean;
  previewError: string | null;
  preview: ExportPolishResult | null;
  polishReadinessPreviewCurrent: boolean;
  onRefreshPreview: () => void;
  onCancelPreview: () => void;
};

export function DeliveryExportPolishPreviewSection({
  llmEnv,
  canPreviewPolish,
  previewLoading,
  previewError,
  preview,
  polishReadinessPreviewCurrent,
  onRefreshPreview,
  onCancelPreview,
}: Props) {
  const typoCount = preview?.lineChanges.filter((r) => !r.punctuationOnly).length ?? 0;
  const punctCount = preview?.lineChanges.filter((r) => r.punctuationOnly).length ?? 0;
  const trackCount = preview?.lineChanges.filter((r) => r.hasTrackChange).length ?? 0;
  const previewNotes = preview
    ? buildExportPolishPreviewNotes(preview.lineChanges, preview.reconcileStats)
    : null;

  return (
    <div className="rounded-md bg-notion-callout-bg px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-notion-text-light">
          修订预览
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={!canPreviewPolish || previewLoading}
            onClick={onRefreshPreview}
          >
            {previewLoading ? llmEnv.polishActiveMessage : preview ? "重新生成" : "生成预览"}
          </button>
          {previewLoading ? (
            <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onCancelPreview}>
              取消
            </button>
          ) : null}
        </div>
      </div>
      {previewError ? <p className="mt-2 text-xs text-zen-cinnabar">{previewError}</p> : null}
      {preview ? (
        <>
          <p className="mt-2 text-xs text-notion-text-muted">
            共 {preview.lineChanges.length} 处语段改动（Word 修订轨 {trackCount}，错字/用词 {typoCount}，标点/空格{" "}
            {punctCount}）；自然段 {preview.paragraphs.length} 段。LLM 采纳错字 {preview.diagnostic.llmTypoLines}{" "}
            行 / 标点 {preview.diagnostic.llmPunctLines} 行
            {preview.diagnostic.acceptedSingleCharRules > 0
              ? `；单字纳入规则 ${preview.diagnostic.acceptedSingleCharRules} 条`
              : ""}
          </p>
          {preview.diagnosticHint ? (
            <p className="mt-1 text-xs text-zen-cinnabar">{preview.diagnosticHint}</p>
          ) : null}
          {polishReadinessPreviewCurrent ? (
            <p className="mt-1 text-xs text-notion-text-muted">导出将复用本次预览，不会再次请求 LLM。</p>
          ) : null}
          {previewNotes && previewNotes.paddedLineIndices.length > 0 ? (
            <p className="mt-1 text-xs text-notion-text-muted">
              保留原文（对齐补行）：语段 {previewNotes.paddedLineIndices.map((i) => `#${i + 1}`).join("、")}
            </p>
          ) : null}
          {previewNotes && previewNotes.noTrackChangeLineIndices.length > 0 ? (
            <p className="mt-1 text-xs text-notion-text-muted">
              有改动但不进 Word 修订轨：语段{" "}
              {previewNotes.noTrackChangeLineIndices
                .slice(0, 8)
                .map((i) => `#${i + 1}`)
                .join("、")}
              {previewNotes.noTrackChangeLineIndices.length > 8
                ? ` 等 ${previewNotes.noTrackChangeLineIndices.length} 行`
                : ""}
            </p>
          ) : null}
          <ul className="mt-2 max-h-36 list-none space-y-1 overflow-y-auto p-0 text-xs text-notion-text">
            {preview.lineChanges.slice(0, PREVIEW_MAX_ROWS).map((row) => (
              <li key={row.lineIndex} className="leading-snug">
                <span className="text-notion-text-muted">#{row.lineIndex + 1}</span> {summarizeLineChange(row)}
              </li>
            ))}
            {preview.lineChanges.length > PREVIEW_MAX_ROWS ? (
              <li className="text-notion-text-muted">…另有 {preview.lineChanges.length - PREVIEW_MAX_ROWS} 处</li>
            ) : null}
            {preview.lineChanges.length === 0 ? (
              <li className="text-notion-text-muted">无错字/标点修订（仅语义分段）。</li>
            ) : null}
          </ul>
        </>
      ) : !previewLoading && !previewError ? (
        <p className={`mt-2 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
          导出前可先生成预览；确认后导出将复用预览结果（语段正文未改则不重复请求 LLM）。
        </p>
      ) : null}
    </div>
  );
}

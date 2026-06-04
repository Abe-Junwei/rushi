import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { SegmentDto } from "../tauri/projectApi";
import {
  exportModeSupportsLlmPolish,
  fetchExportPolishResult,
  type ExportPolishResult,
} from "../services/exportDocxPolish";
import {
  assessExportPolishReadiness,
  buildExportPolishPreviewNotes,
} from "../services/exportPolishDelivery";
import { postprocessCancelExportPolish } from "../tauri/postprocessApi";
import {
  clearExportPolishPreviewCache,
  fingerprintExportPolishSegments,
} from "../services/exportPolishPreviewCache";
import { summarizeLineChange } from "../services/exportPolishPipeline";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { TopBarStatusIndicator } from "./TopBarStatusIndicator";
import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import {
  resolveExportPolishBlockReason,
} from "../services/exportDocxPolish";

const PANEL_ID = "delivery-export-word-v1";
const DEFAULT_SIZE = { width: 400, height: 440 } as const;
const MIN_SIZE = { width: 320, height: 360 } as const;
const PREVIEW_MAX_ROWS = 10;

const MODE_OPTIONS: { id: DocxExportMode; label: string; hint: string }[] = [
  {
    id: "verbatim",
    label: "逐字稿",
    hint: "每段带时间码；低置信语段黄底高亮。",
  },
  {
    id: "lecture",
    label: "讲稿",
    hint: "默认按语段自然段；可选大模型润色（Word 修订模式显示改动）。",
  },
  {
    id: "clean",
    label: "干净稿",
    hint: "默认按语段分段；可选大模型润色（段间空行，修订模式显示改动）。",
  },
];

export type DeliveryExportDialogProps = {
  open: boolean;
  busy: boolean;
  segments: SegmentDto[];
  /** 切换 LLM 来源后递增，用于刷新就绪检测。 */
  llmStatusRefreshSeq?: number;
  onOpenLlmSettings?: () => void;
  onClose: () => void;
  onExport: (
    mode: DocxExportMode,
    includeRevisionAppendix: boolean,
    llmPolish: boolean,
    polishPreview: ExportPolishResult | null,
  ) => void;
};

export function DeliveryExportDialog({
  open,
  busy,
  segments,
  llmStatusRefreshSeq = 0,
  onOpenLlmSettings,
  onClose,
  onExport,
}: DeliveryExportDialogProps) {
  const { presentation: llmEnv } = useLlmEnvStatus(llmStatusRefreshSeq);
  const exportPolishBlockReason = resolveExportPolishBlockReason(
    segments,
    llmEnv.blockReason,
  );
  const [mode, setMode] = useState<DocxExportMode>("verbatim");
  const [includeAppendix, setIncludeAppendix] = useState(false);
  const [llmPolish, setLlmPolish] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExportPolishResult | null>(null);
  const segmentsFingerprintRef = useRef("");
  const previewRequestIdRef = useRef<string | null>(null);

  const polishAvailable = exportModeSupportsLlmPolish(mode);
  const polishReadiness = assessExportPolishReadiness(
    segments,
    mode,
    polishAvailable && llmPolish,
    preview,
    llmEnv.blockReason,
  );
  const canPreviewPolish =
    polishAvailable && llmPolish && !exportPolishBlockReason && !busy;
  const exportBlockedByPolish =
    polishAvailable && llmPolish && !polishReadiness.canExport && !busy && !previewLoading;
  const previewNotes = preview
    ? buildExportPolishPreviewNotes(preview.lineChanges, preview.reconcileStats)
    : null;

  useEffect(() => {
    if (!polishAvailable) setLlmPolish(false);
  }, [polishAvailable]);

  useEffect(() => {
    if (!llmPolish) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
    }
  }, [llmPolish]);

  useEffect(() => {
    if (!open) {
      clearExportPolishPreviewCache();
      setPreview(null);
      setPreviewError(null);
      segmentsFingerprintRef.current = "";
      return;
    }
    const fp = fingerprintExportPolishSegments(segments);
    if (segmentsFingerprintRef.current && segmentsFingerprintRef.current !== fp) {
      setPreview(null);
      setPreviewError(null);
      clearExportPolishPreviewCache();
    }
    segmentsFingerprintRef.current = fp;
  }, [open, segments]);

  const handleCancelPreview = useCallback(async () => {
    const id = previewRequestIdRef.current;
    if (id) {
      try {
        await postprocessCancelExportPolish(id);
      } catch {
        /* 忽略取消失败 */
      }
    }
    previewRequestIdRef.current = null;
    setPreviewLoading(false);
    setPreviewError("已取消预览生成。");
  }, []);

  const handleRefreshPreview = useCallback(async () => {
    if (!canPreviewPolish) return;
    const requestId = crypto.randomUUID();
    previewRequestIdRef.current = requestId;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await fetchExportPolishResult(segments, { requestId });
      setPreview(result);
    } catch (e) {
      setPreview(null);
      setPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      previewRequestIdRef.current = null;
      setPreviewLoading(false);
    }
  }, [canPreviewPolish, segments]);

  if (!open || typeof document === "undefined") return null;

  const handleClose = () => {
    if (!busy && !previewLoading) onClose();
  };

  const typoCount = preview?.lineChanges.filter((r) => !r.punctuationOnly).length ?? 0;
  const punctCount = preview?.lineChanges.filter((r) => r.punctuationOnly).length ?? 0;
  const trackCount = preview?.lineChanges.filter((r) => r.hasTrackChange).length ?? 0;

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id={PANEL_ID}
        title="交付导出 Word"
        preset="compactDialog"
        minWidth={MIN_SIZE.width}
        minHeight={MIN_SIZE.height}
        defaultSize={DEFAULT_SIZE}
        persistState
        onClose={handleClose}
      >
        <div className="flex flex-col gap-3 px-5 py-3" role="dialog" aria-modal="true">
          <p className={PANEL_TYPOGRAPHY.dialogBody}>
            导出前将自动保存编辑器中未提交的语段正文，与当前波形列表一致。
          </p>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="text-xs font-semibold uppercase tracking-wide text-notion-text-light">
              版式
            </legend>
            {MODE_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer gap-2 rounded-md border border-notion-divider bg-notion-callout-bg px-3 py-2 has-[:checked]:border-zen-saffron/40"
              >
                <input
                  type="radio"
                  name="docx-export-mode"
                  className="mt-1"
                  checked={mode === opt.id}
                  disabled={busy || previewLoading}
                  onChange={() => setMode(opt.id)}
                />
                <span className="min-w-0">
                  <span className={`block font-semibold ${PANEL_TYPOGRAPHY.dialogText}`}>{opt.label}</span>
                  <span className="block text-xs leading-snug text-notion-text-muted">{opt.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {polishAvailable ? (
            <div className="space-y-2">
              <label
                className={`flex items-start gap-2 ${PANEL_TYPOGRAPHY.dialogBody} ${
                  exportPolishBlockReason ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                } text-notion-text`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={llmPolish}
                  disabled={busy || previewLoading || Boolean(exportPolishBlockReason)}
                  onChange={(e) => setLlmPolish(e.target.checked)}
                />
                <span>
                  大模型润色（可选）
                  <span className="block text-xs text-notion-text-muted">
                    修订轨仅标错字与标点；口语重复字（喔喔喔等）本地自动压缩。请重新生成预览后再导出。
                  </span>
                  {exportPolishBlockReason ? (
                    <span className="mt-1 block text-xs text-zen-cinnabar">{exportPolishBlockReason}</span>
                  ) : null}
                </span>
              </label>
              {llmPolish ? (
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <TopBarStatusIndicator
                    label={llmEnv.sourceLabel}
                    tone={llmEnv.tone}
                    onClick={onOpenLlmSettings}
                    title={`${llmEnv.chipLabel} · 点击打开 LLM 配置`}
                  />
                  {!llmEnv.ok && llmEnv.blockReason && !exportPolishBlockReason ? (
                    <span className="text-xs text-zen-cinnabar">{llmEnv.blockReason}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {canPreviewPolish || previewLoading || preview || previewError ? (
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
                    onClick={() => void handleRefreshPreview()}
                  >
                    {previewLoading ? llmEnv.polishActiveMessage : preview ? "重新生成" : "生成预览"}
                  </button>
                  {previewLoading ? (
                    <button
                      type="button"
                      className={CONTROL_BTN_SECONDARY}
                      onClick={() => void handleCancelPreview()}
                    >
                      取消
                    </button>
                  ) : null}
                </div>
              </div>
              {previewError ? (
                <p className="mt-2 text-xs text-zen-cinnabar">{previewError}</p>
              ) : null}
              {preview ? (
                <>
                  <p className="mt-2 text-xs text-notion-text-muted">
                    共 {preview.lineChanges.length} 处语段改动（Word 修订轨 {trackCount}，错字/用词{" "}
                    {typoCount}，标点/空格 {punctCount}）；自然段 {preview.paragraphs.length} 段。LLM
                    采纳错字{" "}
                    {preview.diagnostic.llmTypoLines} 行 / 标点 {preview.diagnostic.llmPunctLines}{" "}
                    行
                    {preview.diagnostic.acceptedSingleCharRules > 0
                      ? `；单字纳入规则 ${preview.diagnostic.acceptedSingleCharRules} 条`
                      : ""}
                  </p>
                  {preview.diagnosticHint ? (
                    <p className="mt-1 text-xs text-zen-cinnabar">{preview.diagnosticHint}</p>
                  ) : null}
                  {polishReadiness.previewCurrent ? (
                    <p className="mt-1 text-xs text-notion-text-muted">
                      导出将复用本次预览，不会再次请求 LLM。
                    </p>
                  ) : null}
                  {previewNotes && previewNotes.paddedLineIndices.length > 0 ? (
                    <p className="mt-1 text-xs text-notion-text-muted">
                      保留原文（对齐补行）：语段{" "}
                      {previewNotes.paddedLineIndices.map((i) => `#${i + 1}`).join("、")}
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
                        <span className="text-notion-text-muted">#{row.lineIndex + 1}</span>{" "}
                        {summarizeLineChange(row)}
                      </li>
                    ))}
                    {preview.lineChanges.length > PREVIEW_MAX_ROWS ? (
                      <li className="text-notion-text-muted">
                        …另有 {preview.lineChanges.length - PREVIEW_MAX_ROWS} 处
                      </li>
                    ) : null}
                    {preview.lineChanges.length === 0 ? (
                      <li className="text-notion-text-muted">无错字/标点修订（仅语义分段）。</li>
                    ) : null}
                  </ul>
                </>
              ) : !previewLoading && !previewError ? (
                <p className="mt-2 text-xs text-notion-text-muted">
                  导出前可先生成预览；确认后导出将复用预览结果（语段正文未改则不重复请求 LLM）。
                </p>
              ) : null}
            </div>
          ) : null}
          <label className={`flex cursor-pointer items-start gap-2 ${PANEL_TYPOGRAPHY.dialogText}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includeAppendix}
              disabled={busy || previewLoading}
              onChange={(e) => setIncludeAppendix(e.target.checked)}
            />
            <span>
              附加「修订摘要」附录
              <span className="block text-xs text-notion-text-muted">
                摘录本项目近期编辑记录，非 Word 批注轨。
              </span>
            </span>
          </label>
          {exportBlockedByPolish && polishReadiness.blockReason ? (
            <p className="text-xs text-zen-cinnabar">{polishReadiness.blockReason}</p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={busy || previewLoading}
              onClick={handleClose}
            >
              取消
            </button>
            <button
              type="button"
              className={CONTROL_BTN_PRIMARY}
              disabled={busy || previewLoading || exportBlockedByPolish}
              onClick={() =>
                onExport(
                  mode,
                  includeAppendix,
                  polishAvailable && llmPolish,
                  polishAvailable && llmPolish ? preview : null,
                )
              }
            >
              {busy ? "导出中…" : "导出 DOCX…"}
            </button>
          </div>
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

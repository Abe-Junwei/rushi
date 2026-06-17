import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { SegmentDto } from "../tauri/projectApi";
import {
  exportModeSupportsLlmPolish,
  type ExportPolishResult,
} from "../services/exportDocxPolish";
import { assessExportPolishReadiness } from "../services/exportPolishDelivery";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { FloatingPanelDialogFooter, FloatingPanelDialogRoot, FloatingPanelDialogScroll } from "./FloatingPanelDialogLayout";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { TopBarStatusIndicator } from "./TopBarStatusIndicator";
import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import { useFloatingPanelBodyMeasure } from "../hooks/useFloatingPanelBodyMeasure";
import { mergeContentFitHeights, resolveMeasuredPanelFitHeight } from "./floatingPanelFitSections";
import { resolveExportPolishBlockReason } from "../services/exportDocxPolish";
import { useDeliveryExportPolishPreview } from "../hooks/useDeliveryExportPolishPreview";
import { DeliveryExportPolishPreviewSection } from "./DeliveryExportPolishPreviewSection";
import {
  listDocxProjectMetadataPreviewLines,
  type DocxProjectMetadata,
} from "../services/exportDeliveryAppendix";
import { DeliveryExportModeSection } from "./DeliveryExportModeSection";
import { readFloatingPanelViewport } from "./floatingPanelViewport";

const PANEL_ID = "delivery-export-word-v2";
const DEFAULT_WIDTH = 440;
const DEFAULT_BODY_HEIGHT = 528;
const MIN_SIZE = { width: 360, height: 420 } as const;
const PANEL_MARGIN = 24;

export type DeliveryExportDialogProps = {
  open: boolean;
  busy: boolean;
  segments: SegmentDto[];
  projectName: string;
  projectMetadata?: DocxProjectMetadata;
  /** 切换 LLM 来源后递增，用于刷新就绪检测。 */
  llmStatusRefreshSeq?: number;
  onOpenLlmSettings?: () => void;
  onClose: () => void;
  onExport: (
    mode: DocxExportMode,
    includeRevisionAppendix: boolean,
    includeProjectMetadata: boolean,
    llmPolish: boolean,
    polishPreview: ExportPolishResult | null,
  ) => void;
};

export function DeliveryExportDialog({
  open,
  busy,
  segments,
  projectName,
  projectMetadata,
  llmStatusRefreshSeq = 0,
  onOpenLlmSettings,
  onClose,
  onExport,
}: DeliveryExportDialogProps) {
  const { presentation: llmEnv } = useLlmEnvStatus(llmStatusRefreshSeq);
  const exportPolishBlockReason = resolveExportPolishBlockReason(segments, llmEnv.blockReason);
  const [mode, setMode] = useState<DocxExportMode>("verbatim");
  const [includeAppendix, setIncludeAppendix] = useState(false);
  const [includeProjectMetadata, setIncludeProjectMetadata] = useState(false);
  const [llmPolish, setLlmPolish] = useState(false);
  const { bodyRef, bodyHeight } = useFloatingPanelBodyMeasure(open);

  const polishAvailable = exportModeSupportsLlmPolish(mode);
  const canPreviewPolish =
    polishAvailable && llmPolish && !exportPolishBlockReason && !busy;

  const polishPreview = useDeliveryExportPolishPreview({
    open,
    busy,
    segments,
    llmPolish,
    canPreviewPolish,
  });

  const polishReadiness = assessExportPolishReadiness(
    segments,
    mode,
    polishAvailable && llmPolish,
    polishPreview.preview,
    llmEnv.blockReason,
  );
  const exportBlockedByPolish =
    polishAvailable &&
    llmPolish &&
    !polishReadiness.canExport &&
    !busy &&
    !polishPreview.previewLoading;

  const metadataPreviewLines = listDocxProjectMetadataPreviewLines(projectMetadata);
  const exportTitleLine = `导出：${projectName.trim() || "未命名"} · …`;

  useEffect(() => {
    if (!polishAvailable) setLlmPolish(false);
  }, [polishAvailable]);

  if (!open || typeof document === "undefined") return null;

  const handleClose = () => {
    if (!busy && !polishPreview.previewLoading) onClose();
  };

  const viewport = readFloatingPanelViewport();
  const panelMaxWidth = Math.min(560, Math.max(MIN_SIZE.width, viewport.width - PANEL_MARGIN * 2));
  const panelMaxHeight = Math.min(720, Math.max(MIN_SIZE.height, viewport.height - PANEL_MARGIN * 2));

  const measuredFit = bodyHeight != null ? resolveMeasuredPanelFitHeight(bodyHeight) : null;
  const contentFitHeight = mergeContentFitHeights(DEFAULT_BODY_HEIGHT, measuredFit);
  const defaultPanelHeight = Math.min(contentFitHeight ?? DEFAULT_BODY_HEIGHT, panelMaxHeight);

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id={PANEL_ID}
        title="交付导出 Word"
        preset="findReplace"
        minWidth={MIN_SIZE.width}
        minHeight={MIN_SIZE.height}
        maxWidth={panelMaxWidth}
        maxHeight={panelMaxHeight}
        defaultSize={{ width: DEFAULT_WIDTH, height: defaultPanelHeight }}
        contentFitHeight={contentFitHeight}
        persistPhaseKey="default"
        panelZIndex={110}
        persistState
        onClose={handleClose}
      >
        <FloatingPanelDialogRoot role="dialog" aria-modal={true} measureRef={bodyRef}>
          <FloatingPanelDialogScroll className="flex flex-col gap-3">
            <p className={PANEL_TYPOGRAPHY.dialogBody}>
              导出前将自动保存编辑器中未提交的语段正文，与当前波形列表一致。
            </p>
            <DeliveryExportModeSection
              mode={mode}
              exportBusy={polishPreview.exportBusy}
              onModeChange={setMode}
            />
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="text-xs font-semibold uppercase tracking-wide text-notion-text-light">
                Word 抬头
              </legend>
              <p className="text-xs leading-snug text-notion-text-muted">
                标题下方默认仅写入「{exportTitleLine}」。勾选后可追加 Hub「项目信息」中的场次字段。
              </p>
              <label className={`flex cursor-pointer items-start gap-2 ${PANEL_TYPOGRAPHY.dialogText}`}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={includeProjectMetadata}
                  disabled={polishPreview.exportBusy}
                  onChange={(e) => setIncludeProjectMetadata(e.target.checked)}
                />
                <span>
                  附带项目场次信息
                  <span className="block text-xs text-notion-text-muted">
                    写入讲述人、时间、地点、主题、转录人；未填写的项自动省略。
                  </span>
                </span>
              </label>
              {includeProjectMetadata ? (
                <div
                  className="flex flex-col gap-2 rounded-md bg-notion-callout-bg px-3 py-2"
                  aria-live="polite"
                  aria-label="Word 抬头预览"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-notion-text-light">
                    将写入 Word 标题下方
                  </p>
                  <p className="text-xs text-notion-text-muted">{exportTitleLine}</p>
                  {metadataPreviewLines.length > 0 ? (
                    <ul className="list-none space-y-1 p-0 text-xs text-notion-text">
                      {metadataPreviewLines.map((row) => (
                        <li key={row.label} className="leading-snug">
                          <span className="text-notion-text-muted">{row.label}：</span>
                          {row.value}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zen-cinnabar">
                      当前项目尚未填写场次信息；勾选后 Word 中仍只有导出行。请先在 Hub「项目信息」中填写。
                    </p>
                  )}
                </div>
              ) : null}
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
                    disabled={polishPreview.exportBusy || Boolean(exportPolishBlockReason)}
                    onChange={(e) => setLlmPolish(e.target.checked)}
                  />
                  <span>
                    大模型润色（可选）
                    <span className="block text-xs text-notion-text-muted">
                      修订轨仅标错字与标点；口语重复字（喔喔喔等）本地自动压缩。请重新生成预览后再导出。
                    </span>
                    {exportPolishBlockReason ? (
                      <span className="block text-xs text-zen-cinnabar">{exportPolishBlockReason}</span>
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
            {polishPreview.showPreviewSection ? (
              <DeliveryExportPolishPreviewSection
                llmEnv={llmEnv}
                canPreviewPolish={canPreviewPolish}
                previewLoading={polishPreview.previewLoading}
                previewError={polishPreview.previewError}
                preview={polishPreview.preview}
                polishReadinessPreviewCurrent={polishReadiness.previewCurrent}
                onRefreshPreview={() => void polishPreview.handleRefreshPreview()}
                onCancelPreview={() => void polishPreview.handleCancelPreview()}
              />
            ) : null}
            <label className={`flex cursor-pointer items-start gap-2 ${PANEL_TYPOGRAPHY.dialogText}`}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeAppendix}
                disabled={polishPreview.exportBusy}
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
          </FloatingPanelDialogScroll>
          <FloatingPanelDialogFooter justify="end">
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={polishPreview.exportBusy}
              onClick={handleClose}
            >
              取消
            </button>
            <button
              type="button"
              className={CONTROL_BTN_PRIMARY}
              disabled={polishPreview.exportBusy || exportBlockedByPolish}
              onClick={() =>
                onExport(
                  mode,
                  includeAppendix,
                  includeProjectMetadata,
                  polishAvailable && llmPolish,
                  polishAvailable && llmPolish ? polishPreview.preview : null,
                )
              }
            >
              {busy ? "导出中…" : "导出 DOCX…"}
            </button>
          </FloatingPanelDialogFooter>
        </FloatingPanelDialogRoot>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

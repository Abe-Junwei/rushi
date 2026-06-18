import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
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
import type { DocxProjectMetadata } from "../services/exportDeliveryAppendix";
import { listDocxProjectMetadataPreviewLines } from "../services/exportDeliveryAppendix";
import { DeliveryExportModeSection } from "./DeliveryExportModeSection";
import { DeliveryExportMetadataSection } from "./DeliveryExportMetadataSection";
import { readFloatingPanelViewport } from "./floatingPanelViewport";
import { resolveDeliveryExportLayoutRev } from "./deliveryExportLayoutRev";

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

  const exportTitleLine = `导出：${projectName.trim() || "未命名"} · …`;
  const metadataPreviewLines = listDocxProjectMetadataPreviewLines(projectMetadata);

  useEffect(() => {
    if (!polishAvailable) setLlmPolish(false);
  }, [polishAvailable]);

  const layoutRev = useMemo(
    () =>
      resolveDeliveryExportLayoutRev({
        mode,
        includeProjectMetadata,
        metadataLineCount: metadataPreviewLines.length,
        polishAvailable,
        llmPolish,
        showPolishPreviewSection: polishPreview.showPreviewSection,
        polishPreviewLoading: polishPreview.previewLoading,
        hasPolishPreview: polishPreview.preview != null,
        hasPolishPreviewError: Boolean(polishPreview.previewError),
        hasPolishBlockReason: Boolean(exportPolishBlockReason),
        exportBlockedByPolish,
        includeAppendix,
      }),
    [
      mode,
      includeProjectMetadata,
      metadataPreviewLines.length,
      polishAvailable,
      llmPolish,
      polishPreview.showPreviewSection,
      polishPreview.previewLoading,
      polishPreview.preview,
      polishPreview.previewError,
      exportPolishBlockReason,
      exportBlockedByPolish,
      includeAppendix,
    ],
  );

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
        layoutRev={layoutRev}
        panelZIndex={110}
        persistState
        onClose={handleClose}
      >
        <FloatingPanelDialogRoot role="dialog" aria-modal={true} measureRef={bodyRef} hasFooter fillHeight>
          <FloatingPanelDialogScroll className="flex flex-col gap-3">
            <p className={PANEL_TYPOGRAPHY.dialogBody}>
              导出前将自动保存编辑器中未提交的语段正文，与当前波形列表一致。
            </p>
            <DeliveryExportModeSection
              mode={mode}
              exportBusy={polishPreview.exportBusy}
              onModeChange={setMode}
            />
            <DeliveryExportMetadataSection
              exportBusy={polishPreview.exportBusy}
              exportTitleLine={exportTitleLine}
              includeProjectMetadata={includeProjectMetadata}
              projectMetadata={projectMetadata}
              onIncludeProjectMetadataChange={setIncludeProjectMetadata}
            />
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

import { useState } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { SegmentDto } from "../tauri/projectApi";
import {
  exportModeSupportsLlmPolish,
  exportWantsLlmPolish,
} from "../services/exportDocxPolish";
import { assessExportPolishReadiness } from "../services/exportPolishDelivery";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { FloatingPanelDialogScroll } from "./FloatingPanelDialogLayout";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { TopBarStatusIndicator } from "./TopBarStatusIndicator";
import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import { resolveExportPolishBlockReason } from "../services/exportDocxPolish";
import type { DocxProjectMetadata } from "../services/exportDeliveryAppendix";
import { DeliveryExportModeSection } from "./DeliveryExportModeSection";
import { DeliveryExportMetadataSection } from "./DeliveryExportMetadataSection";
import { readFloatingPanelViewport } from "./floatingPanelViewport";

const PANEL_ID = "delivery-export-word-v2";
const DEFAULT_WIDTH = 440;
const DEFAULT_BODY_HEIGHT = 480;
const MIN_SIZE = { width: 360, height: 380 } as const;
const PANEL_MARGIN = 24;

export type DeliveryExportDialogProps = {
  open: boolean;
  busy: boolean;
  segments: SegmentDto[];
  projectName: string;
  /** Word 封面标题预览用（当前文件名；无文件时回退项目名）。 */
  documentTitle?: string;
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
  ) => void;
};

export function DeliveryExportDialog({
  open,
  busy,
  segments,
  projectName: _projectName,
  documentTitle: _documentTitle,
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
  const polishAvailable = exportModeSupportsLlmPolish(mode);
  const effectiveLlmPolish = exportWantsLlmPolish(mode, true);
  const polishReadiness = assessExportPolishReadiness(
    segments,
    mode,
    effectiveLlmPolish,
    llmEnv.blockReason,
  );
  const exportBlockedByPolish =
    effectiveLlmPolish && !polishReadiness.canExport && !busy;

  if (!open) return null;

  const handleClose = () => {
    if (!busy) onClose();
  };

  const viewport = readFloatingPanelViewport();
  const panelMaxWidth = Math.min(560, Math.max(MIN_SIZE.width, viewport.width - PANEL_MARGIN * 2));
  const panelMaxHeight = Math.min(720, Math.max(MIN_SIZE.height, viewport.height - PANEL_MARGIN * 2));

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="交付导出 Word"
      open={open}
      onClose={handleClose}
      fitKind="fill"
      shellPreset="findReplace"
      fallbackHeight={DEFAULT_BODY_HEIGHT}
      defaultWidth={DEFAULT_WIDTH}
      minWidth={MIN_SIZE.width}
      minHeight={MIN_SIZE.height}
      maxWidth={panelMaxWidth}
      maxHeight={panelMaxHeight}
      persistPhaseKey="default"
      persistState
      rootRole="dialog"
      footer={
        <>
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={busy}
            onClick={handleClose}
          >
            取消
          </button>
          <button
            type="button"
            className={CONTROL_BTN_PRIMARY}
            disabled={busy || exportBlockedByPolish}
            onClick={() =>
              onExport(
                mode,
                includeAppendix,
                includeProjectMetadata,
                effectiveLlmPolish,
              )
            }
          >
            {busy ? "导出中…" : "导出 DOCX…"}
          </button>
        </>
      }
      footerJustify="end"
    >
      <FloatingPanelDialogScroll className="flex flex-col gap-3">
            <p className={PANEL_TYPOGRAPHY.dialogBody}>
              导出前将自动保存编辑器中未提交的语段正文，与当前波形列表一致。讲稿优化会直接生成 Word 修订稿，可在 Word 中逐条接受或拒绝。
            </p>
            <DeliveryExportModeSection
              mode={mode}
              exportBusy={busy}
              onModeChange={setMode}
            />
            <DeliveryExportMetadataSection
              exportBusy={busy}
              includeProjectMetadata={includeProjectMetadata}
              projectMetadata={projectMetadata}
              onIncludeProjectMetadataChange={setIncludeProjectMetadata}
            />
            {polishAvailable ? (
              <div className="space-y-2">
                <div className={`flex items-start gap-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}>
                  <span className="pl-1">
                    {mode === "lecture" ? "讲稿优化修订" : "LLM 保真整理"}
                    <span className="block text-xs text-notion-text-muted">
                      {mode === "lecture"
                        ? "模型建议会全部写入 Word 修订轨；拒绝某条修订可恢复对应原文，拒绝全部可恢复完整原稿。"
                        : "只整理可信错字、标点和自然段；超范围改写会回退原文。"}
                    </span>
                    {exportPolishBlockReason ? (
                      <span className="block text-xs text-zen-cinnabar">{exportPolishBlockReason}</span>
                    ) : null}
                  </span>
                </div>
                  <div className="flex flex-wrap items-center gap-2 pl-1">
                    <TopBarStatusIndicator
                      label={llmEnv.sourceLabel}
                      tone={llmEnv.tone}
                      title={`${llmEnv.chipLabel} · 点击打开 LLM 配置`}
                      {...(!onOpenLlmSettings ? {} : { onClick: onOpenLlmSettings })}
                    />
                    {!llmEnv.ok && llmEnv.blockReason && !exportPolishBlockReason ? (
                      <span className="text-xs text-zen-cinnabar">{llmEnv.blockReason}</span>
                    ) : null}
                  </div>
              </div>
            ) : null}
            <label className={`flex cursor-pointer items-start gap-2 ${PANEL_TYPOGRAPHY.dialogText}`}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeAppendix}
                disabled={busy}
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
    </CompactFloatingDialog>
  );
}

import { useMemo } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { CORRECTION_MEMORY_STABLE_HIT } from "../../services/editor/learningCorrectionRuleHints";
import type { LexiconBundleExportPreview } from "../../tauri/lexiconBundleApi";
import {
  formatLexiconBundleExportCleanupHints,
  formatLexiconBundleExportPreviewSummary,
} from "../../tauri/lexiconBundleApi";
import { resolveFloatingPanelSectionsFitHeight } from "../floatingPanelFitSections";
import { CompactFloatingDialog } from "../CompactFloatingDialog";
import { FloatingPanelDialogHeader, FloatingPanelDialogScroll } from "../FloatingPanelDialogLayout";

const PANEL_ID = "lexicon-bundle-export-v1";
const FALLBACK_HEIGHT = 320;

type Props = {
  preview: LexiconBundleExportPreview | null;
  previewLoading: boolean;
  stableOnly: boolean;
  exportLabel: string;
  disabled: boolean;
  onStableOnlyChange: (checked: boolean) => void;
  onExportLabelChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LexiconBundleExportDialog({
  preview,
  previewLoading,
  stableOnly,
  exportLabel,
  disabled,
  onStableOnlyChange,
  onExportLabelChange,
  onCancel,
  onConfirm,
}: Props) {
  const cleanupHints = preview ? formatLexiconBundleExportCleanupHints(preview, stableOnly) : [];
  const hintCount = cleanupHints.length;

  const estimatedFitHeight = useMemo(
    () =>
      resolveFloatingPanelSectionsFitHeight([
        { kind: "mutedLine", show: true },
        { kind: "static", px: 112 },
        hintCount > 0
          ? { kind: "static", px: 56 + hintCount * 24 }
          : { kind: "mutedLine", show: true },
      ]),
    [hintCount],
  );

  const layoutRev = hintCount + (stableOnly ? 100 : 0) + (previewLoading ? 1000 : 0);

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="导出词表包"
      open
      onClose={() => {
        if (!disabled) onCancel();
      }}
      fallbackHeight={FALLBACK_HEIGHT}
      estimatedFitHeight={estimatedFitHeight}
      layoutRev={layoutRev}
      defaultWidth={480}
      bounds={{ minWidth: 400, minHeight: 260, maxWidthCap: 520, maxHeightCap: 560 }}
      footer={
        <>
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={disabled} onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={CONTROL_BTN_PRIMARY}
            disabled={disabled || previewLoading || preview == null}
            onClick={onConfirm}
          >
            选择保存位置…
          </button>
        </>
      }
      footerJustify="end"
    >
      <FloatingPanelDialogHeader>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          {previewLoading
            ? "正在统计将导出的术语与规则…"
            : preview
              ? formatLexiconBundleExportPreviewSummary(preview, stableOnly)
              : "无法加载导出预览"}
        </p>
      </FloatingPanelDialogHeader>
      <FloatingPanelDialogScroll>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-notion-text">
            <input
              type="checkbox"
              checked={stableOnly}
              disabled={disabled || previewLoading}
              onChange={(e) => onStableOnlyChange(e.target.checked)}
            />
            仅导出稳定记忆（满 {CORRECTION_MEMORY_STABLE_HIT} 次或已采纳）
          </label>
          <label className="flex flex-col gap-1">
            <span className={PANEL_TYPOGRAPHY.meta}>来源标签（可选）</span>
            <input
              type="text"
              value={exportLabel}
              disabled={disabled || previewLoading}
              onChange={(e) => onExportLabelChange(e.target.value)}
              placeholder="例如：栏目 A / 用户 B"
              className={CONTROL_TEXT_INPUT}
            />
          </label>
          {hintCount > 0 ? (
            <div className="flex flex-col gap-2 rounded-md bg-notion-callout-bg px-3 py-2">
              <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} font-medium text-notion-text`}>
                导出前建议关注
              </p>
              <ul
                className={`m-0 list-disc space-y-1 pl-5 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}
              >
                {cleanupHints.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
              未发现需清理的噪声记忆或同错形冲突。
            </p>
          )}
        </div>
      </FloatingPanelDialogScroll>
    </CompactFloatingDialog>
  );
}

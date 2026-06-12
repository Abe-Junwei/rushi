import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_SELECT } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { LexiconBundleConflictResolution } from "../../tauri/lexiconBundleApi";
import type { LexiconBundleImportPreviewResult } from "../../tauri/lexiconBundleApi";
import { formatLexiconBundlePreviewSummary } from "../../tauri/lexiconBundleApi";
import { CompactFloatingDialog } from "../CompactFloatingDialog";
import { FloatingPanelDialogHeader, FloatingPanelDialogScroll } from "../FloatingPanelDialogLayout";

const PANEL_ID = "lexicon-bundle-import-v2";
const FALLBACK_HEIGHT = 360;

type Props = {
  pending: LexiconBundleImportPreviewResult;
  resolutions: Record<string, LexiconBundleConflictResolution["choice"]>;
  disabled: boolean;
  onChoice: (id: string, choice: LexiconBundleConflictResolution["choice"]) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LexiconBundleImportDialog({
  pending,
  resolutions,
  disabled,
  onChoice,
  onCancel,
  onConfirm,
}: Props) {
  const { preview } = pending;
  const conflictCount = preview.conflicts.length;
  const estimatedFitHeight = 220 + Math.min(conflictCount, 6) * 76;

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="导入词表包"
      open
      onClose={() => {
        if (!disabled) onCancel();
      }}
      fallbackHeight={FALLBACK_HEIGHT}
      estimatedFitHeight={estimatedFitHeight}
      defaultWidth={520}
      bounds={{ minWidth: 400, minHeight: 280, maxWidthCap: 560, maxHeightCap: 640 }}
      footer={
        <>
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={disabled} onClick={onCancel}>
            取消
          </button>
          <button type="button" className={CONTROL_BTN_PRIMARY} disabled={disabled} onClick={onConfirm}>
            应用导入
          </button>
        </>
      }
      footerJustify="end"
    >
      <FloatingPanelDialogHeader>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{formatLexiconBundlePreviewSummary(preview)}</p>
      </FloatingPanelDialogHeader>
      <FloatingPanelDialogScroll>
        <ul className="m-0 list-none space-y-3 p-0">
          {preview.conflicts.map((c) => (
            <li key={c.id} className="rounded-md bg-notion-callout-bg px-3 py-2">
              <p className={`m-0 mb-2 ${PANEL_TYPOGRAPHY.dialogText}`}>{c.message}</p>
              <select
                value={resolutions[c.id] ?? "local"}
                disabled={disabled}
                onChange={(e) => onChoice(c.id, e.target.value as LexiconBundleConflictResolution["choice"])}
                className={CONTROL_SELECT}
                aria-label={`冲突处理方式：${c.id}`}
              >
                {c.kind === "glossary" ? (
                  <>
                    <option value="local">保留本地</option>
                    <option value="bundle">使用包内</option>
                    <option value="merge_aliases">合并别名</option>
                    <option value="skip">跳过</option>
                  </>
                ) : (
                  <>
                    <option value="local">保留本地规则</option>
                    <option value="bundle">使用包内规则</option>
                    <option value="skip">跳过</option>
                  </>
                )}
              </select>
            </li>
          ))}
        </ul>
      </FloatingPanelDialogScroll>
    </CompactFloatingDialog>
  );
}

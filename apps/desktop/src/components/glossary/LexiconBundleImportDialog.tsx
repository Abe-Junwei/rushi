import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../../config/typography";
import type { LexiconBundleConflictResolution } from "../../tauri/lexiconBundleApi";
import type { LexiconBundleImportPreviewResult } from "../../tauri/lexiconBundleApi";
import { formatLexiconBundlePreviewSummary } from "../../tauri/lexiconBundleApi";
import { FloatingPanelTemplate } from "../PanelTemplate";
import { FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS } from "../FloatingPanelDialogLayout";

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
  if (typeof document === "undefined") return null;
  const { preview } = pending;

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id="lexicon-bundle-import-v1"
        title="导入词表包"
        preset="compactDialog"
        minWidth={400}
        minHeight={320}
        defaultSize={{ width: 520, height: 440 }}
        persistState={false}
        onClose={() => {
          if (!disabled) onCancel();
        }}
      >
        <div className={`flex min-h-0 flex-1 flex-col gap-3 ${FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS}`}>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{formatLexiconBundlePreviewSummary(preview)}</p>
          <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-3 overflow-y-auto p-0">
            {preview.conflicts.map((c) => (
              <li key={c.id} className="rounded-md bg-notion-callout-bg px-3 py-2">
                <p className={`m-0 mb-2 ${PANEL_TYPOGRAPHY.dialogText}`}>{c.message}</p>
                <select
                  value={resolutions[c.id] ?? "local"}
                  disabled={disabled}
                  onChange={(e) =>
                    onChoice(c.id, e.target.value as LexiconBundleConflictResolution["choice"])
                  }
                  className={`w-full min-h-[36px] rounded-lg border border-notion-border bg-notion-bg px-2 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
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
          <div className="flex justify-end gap-2 border-t border-notion-divider pt-3">
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={disabled} onClick={onCancel}>
              取消
            </button>
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={disabled} onClick={onConfirm}>
              应用导入
            </button>
          </div>
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

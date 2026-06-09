import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../../config/typography";
import type { ManualCorrectionMemoryDialogState } from "../../pages/useManualCorrectionMemoryDialog";
import { FloatingPanelTemplate } from "../PanelTemplate";
import { FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS } from "../FloatingPanelDialogLayout";

type Props = {
  state: ManualCorrectionMemoryDialogState;
  busy: boolean;
  onClose: () => void;
  onRightChange: (value: string) => void;
  onAlsoAddToGlossaryChange: (value: boolean) => void;
  onConfirm: () => void;
};

export function ManualCorrectionMemoryDialog({
  state,
  busy,
  onClose,
  onRightChange,
  onAlsoAddToGlossaryChange,
  onConfirm,
}: Props) {
  if (state.phase === "closed" || typeof document === "undefined") return null;

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id="manual-correction-memory-v1"
        title="纳入更正记忆"
        preset="compactDialog"
        minWidth={360}
        minHeight={280}
        defaultSize={{ width: 440, height: 320 }}
        persistState={false}
        onClose={onClose}
      >
        <div className={`flex min-h-0 flex-1 flex-col gap-3 ${FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS}`}>
          <p className={PANEL_TYPOGRAPHY.dialogBody}>
            开始学习这一对词。之后在稿中把错形改成正形，每次保存都会累计；满 3 次将自动加入术语表并可用于「纠错规则」。
          </p>
          <label className={`flex flex-col gap-1 ${PANEL_TYPOGRAPHY.dialogBody}`}>
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>错形（选中文本）</span>
            <span className={`rounded-md bg-notion-sidebar/80 px-3 py-2 font-medium ${PANEL_TYPOGRAPHY.dialogText}`}>
              {state.wrong}
            </span>
          </label>
          <label className={`flex flex-col gap-1 ${PANEL_TYPOGRAPHY.dialogBody}`}>
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>正确形式</span>
            <input
              type="text"
              className={`rounded-md border border-notion-border bg-notion-bg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-zen-saffron/40 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
              value={state.right}
              disabled={busy}
              autoFocus
              placeholder="输入应写入稿本的正形"
              onChange={(e) => onRightChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  onConfirm();
                }
              }}
            />
          </label>
          <label className="flex cursor-pointer gap-2 rounded-md border border-notion-divider bg-notion-callout-bg px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-notion-border text-zen-saffron focus:ring-zen-saffron/30"
              checked={state.alsoAddToGlossary}
              disabled={busy}
              onChange={(e) => onAlsoAddToGlossaryChange(e.target.checked)}
            />
            <span className={`flex flex-col gap-0.5 ${PANEL_TYPOGRAPHY.dialogBody}`}>
              <span className={`font-medium ${PANEL_TYPOGRAPHY.dialogText}`}>同时加入转写词汇表</span>
              <span className={PANEL_TYPOGRAPHY.meta}>
                使用正形作为 term，纳入下次转写热词
              </span>
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onClose}>
              取消
            </button>
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirm}>
              纳入记忆
            </button>
          </div>
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import type { GlossaryLearnPromptDialogState } from "../pages/useGlossaryLearnPromptController";
import type { GlossaryLearnPromptRow } from "../tauri/correctionApi";
import { FloatingPanelTemplate } from "./PanelTemplate";

type Props = {
  state: GlossaryLearnPromptDialogState;
  busy: boolean;
  onClose: () => void;
  onDismiss: (row: GlossaryLearnPromptRow) => void;
  onConfirm: (row: GlossaryLearnPromptRow) => void;
};

export function GlossaryLearnPromptDialog({ state, busy, onClose, onDismiss, onConfirm }: Props) {
  if (state.phase === "closed" || typeof document === "undefined") return null;

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id="glossary-learn-prompt-v1"
        title="加入术语表？"
        preset="compactDialog"
        minWidth={360}
        minHeight={260}
        defaultSize={{ width: 420, height: 320 }}
        persistState={false}
        onClose={onClose}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-3">
          <p className="text-sm text-notion-text-muted">
            以下正词来自纠错记忆，已多次手改确认。加入术语表后，该写法会作为热词参与下次转写（错形不会进入热词）。
          </p>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {state.rows.map((row) => (
              <li key={row.afterText} className="rounded-md bg-notion-sidebar/80 px-3 py-2.5">
                <p className="text-sm font-medium text-notion-text">「{row.afterText}」</p>
                <p className="mt-1 text-xs text-notion-text-muted">
                  已记录 {row.hitCount} 次
                  {row.sampleBefore ? ` · 例：${row.sampleBefore} → ${row.afterText}` : ""}
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className={CONTROL_BTN_SECONDARY}
                    disabled={busy}
                    onClick={() => onDismiss(row)}
                  >
                    暂不
                  </button>
                  <button
                    type="button"
                    className={CONTROL_BTN_PRIMARY}
                    disabled={busy}
                    onClick={() => onConfirm(row)}
                  >
                    加入术语表
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

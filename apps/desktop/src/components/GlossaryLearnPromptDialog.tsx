import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { GlossaryLearnPromptDialogState } from "../pages/useGlossaryLearnPromptController";
import type { GlossaryLearnPromptRow } from "../tauri/correctionApi";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { FloatingPanelDialogHeader, FloatingPanelDialogListRegion } from "./FloatingPanelDialogLayout";

const PANEL_ID = "glossary-learn-prompt-v2";
const FALLBACK_HEIGHT = 280;

type Props = {
  state: GlossaryLearnPromptDialogState;
  busy: boolean;
  onClose: () => void;
  onDismiss: (row: GlossaryLearnPromptRow) => void;
  onConfirm: (row: GlossaryLearnPromptRow) => void;
};

export function GlossaryLearnPromptDialog({ state, busy, onClose, onDismiss, onConfirm }: Props) {
  const open = state.phase !== "closed";
  const rowCount = state.phase === "prompt" ? state.rows.length : 0;
  const estimatedFitHeight = 200 + Math.min(rowCount, 4) * 88;

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="加入术语表？"
      open={open}
      onClose={onClose}
      fallbackHeight={FALLBACK_HEIGHT}
      estimatedFitHeight={estimatedFitHeight}
      defaultWidth={420}
      bounds={{ minWidth: 360, minHeight: 240, maxWidthCap: 480, maxHeightCap: 560 }}
    >
      <FloatingPanelDialogHeader>
        <p className={PANEL_TYPOGRAPHY.dialogBody}>
          以下正词来自纠错记忆，已多次手改确认。加入术语表后，该写法会作为热词参与下次转写（错形不会进入热词）。
        </p>
      </FloatingPanelDialogHeader>
      <FloatingPanelDialogListRegion>
        <ul className="m-0 max-h-[280px] list-none space-y-2 overflow-y-auto p-0">
          {state.phase === "prompt"
            ? state.rows.map((row) => (
                <li key={row.afterText} className="flex flex-col gap-2 rounded-md bg-notion-sidebar/80 px-3 py-2.5">
                  <p className={`font-medium ${PANEL_TYPOGRAPHY.dialogText}`}>「{row.afterText}」</p>
                  <p className="text-xs text-notion-text-muted">
                    已记录 {row.hitCount} 次
                    {row.sampleBefore ? ` · 例：${row.sampleBefore} → ${row.afterText}` : ""}
                  </p>
                  <div className="flex justify-end gap-2">
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
              ))
            : null}
        </ul>
      </FloatingPanelDialogListRegion>
    </CompactFloatingDialog>
  );
}

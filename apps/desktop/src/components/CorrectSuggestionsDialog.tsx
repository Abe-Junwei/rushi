import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { CorrectSuggestionsDialogState } from "../pages/useCorrectSuggestionsController";
import type { CorrectSuggestion } from "../services/editor/correctSuggestions";
import { FloatingPanelTemplate } from "./PanelTemplate";

type Props = {
  state: CorrectSuggestionsDialogState;
  onCancel: () => void;
  onApply: (item: CorrectSuggestion) => void;
  onOpenFindReplace: () => void;
};

export function CorrectSuggestionsDialog({ state, onCancel, onApply, onOpenFindReplace }: Props) {
  if (state.phase === "closed" || typeof document === "undefined") return null;

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id="correct-suggestions-v1"
        title="改正建议"
        preset="compactDialog"
        minWidth={360}
        minHeight={280}
        defaultSize={{ width: 420, height: 360 }}
        persistState={false}
        onClose={onCancel}
      >
        <div className="flex min-h-0 flex-1 flex-col px-5 py-3">
          {state.phase === "loading" ? (
            <p className={PANEL_TYPOGRAPHY.dialogBody}>正在匹配术语表与纠错记忆…</p>
          ) : null}
          {state.phase === "empty" ? (
            <>
              <p className={PANEL_TYPOGRAPHY.dialogBody}>
                选中「{state.selection}」在术语表与纠错记忆中没有字面匹配项。可手动在语段中修改，或使用查找替换批量处理。
              </p>
              <div className="mt-4 flex justify-start gap-2">
                <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onOpenFindReplace}>
                  打开查找替换…
                </button>
                <button type="button" className={CONTROL_BTN_PRIMARY} onClick={onCancel}>
                  关闭
                </button>
              </div>
            </>
          ) : null}
          {state.phase === "results" ? (
            <>
              <p className="text-xs text-notion-text-muted">
                选中：「{state.selection}」— 仅字面匹配，不猜谐音
              </p>
              <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
                {state.items.map((item, i) => (
                  <li key={`${item.kind}-${i}`}>
                    <button
                      type="button"
                      className="w-full rounded-md bg-notion-sidebar/80 px-3 py-2.5 text-left transition-colors hover:bg-notion-sidebar-hover"
                      onClick={() => onApply(item)}
                    >
                      {item.kind === "rule" ? (
                        <>
                          <p className="text-xs font-medium text-notion-text">纠错记忆</p>
                          <p className={`mt-1 ${PANEL_TYPOGRAPHY.dialogText}`}>
                            {item.wrong} → {item.right}
                          </p>
                          <p className="mt-0.5 text-xs text-notion-text-muted">
                            hit {item.hitCount}
                            {item.acceptedAsRule ? " · 已采纳" : ""}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-medium text-notion-text">术语表</p>
                          <p className={`mt-1 ${PANEL_TYPOGRAPHY.dialogText}`}>{item.term}</p>
                          {item.aliases ? (
                            <p className="mt-0.5 text-xs text-notion-text-muted">别名：{item.aliases}</p>
                          ) : null}
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onCancel}>
                  关闭
                </button>
              </div>
            </>
          ) : null}
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

import { History, Redo2, Undo2 } from "lucide-react";
import { CONTROL_BTN_COMPACT_SECONDARY } from "../../config/controlStyles";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { footerHistoryIconBtn } from "./editorSegmentToolbarStyles";
import { formatHistorySubLines, summarizeHistoryHeadline } from "./useEditorEditHistory";
import type { useEditorEditHistory } from "./useEditorEditHistory";

type EditHistoryApi = ReturnType<typeof useEditorEditHistory>;

interface EditorFooterHistoryActionsProps {
  controller: ProjectControllerApi;
  editHistory: EditHistoryApi;
}

export function EditorFooterHistoryActions({ controller: c, editHistory: h }: EditorFooterHistoryActionsProps) {
  return (
    <div className="relative flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        className={footerHistoryIconBtn}
        disabled={c.busy}
        onClick={() => c.undo()}
        aria-label="撤销"
        title="撤销"
      >
        <Undo2 className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>
      <button
        type="button"
        className={footerHistoryIconBtn}
        disabled={c.busy}
        onClick={() => c.redo()}
        aria-label="重做"
        title="重做"
      >
        <Redo2 className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>
      <button
        type="button"
        className={footerHistoryIconBtn}
        disabled={h.historyDisabled}
        onClick={() => void h.toggleHistory()}
        aria-label="编辑历史"
        title="编辑历史"
        aria-expanded={h.historyOpen}
      >
        <History className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>

      {h.historyOpen ? (
        <div className="dropdown-surface absolute bottom-full left-0 z-[90] mb-1 w-[24rem] max-w-[calc(100vw-1rem)] p-2">
          <div className="mb-2 flex items-center justify-between border-b border-notion-divider px-1 pb-1">
            <span className="text-label font-semibold text-notion-text">编辑历史</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={CONTROL_BTN_COMPACT_SECONDARY}
                onClick={() => void h.loadEditHistory()}
                disabled={h.historyBusy}
              >
                刷新
              </button>
              <button
                type="button"
                className={CONTROL_BTN_COMPACT_SECONDARY}
                onClick={() => h.setHistoryOpen(false)}
              >
                关闭
              </button>
            </div>
          </div>
          {h.historyBusy ? (
            <div className="px-1 py-2 text-label text-notion-text-muted">正在加载...</div>
          ) : h.historyError ? (
            <div className="px-1 py-2 text-label text-zen-cinnabar">{h.historyError}</div>
          ) : h.historyRows.length === 0 ? (
            <div className="px-1 py-2 text-label text-notion-text-muted">暂无记录</div>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto px-1 py-1">
              {h.historyRows.map((row) => {
                const subLines = formatHistorySubLines(row.detail);
                const headline = summarizeHistoryHeadline(row.detail, row.kind);
                const showRestore = h.canRestoreRow(row);
                return (
                  <li key={row.id} className="rounded-md border border-notion-divider bg-notion-bg px-2 py-1.5">
                    <p className="text-label text-notion-text-muted">{new Date(row.at_ms).toLocaleString()}</p>
                    <p className="mt-0.5 text-label font-medium leading-snug text-notion-text">{headline}</p>
                    {subLines.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 border-t border-notion-divider/60 pt-1">
                        {subLines.map((line) => (
                          <li key={line} className="text-label leading-snug text-notion-text-muted">
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {showRestore ? (
                      <div className="mt-1.5 border-t border-notion-divider/60 pt-1.5">
                        <button
                          type="button"
                          className={CONTROL_BTN_COMPACT_SECONDARY}
                          disabled={h.historyDisabled || h.restoreBusy}
                          onClick={() => h.requestRestore(row)}
                        >
                          恢复此版本
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

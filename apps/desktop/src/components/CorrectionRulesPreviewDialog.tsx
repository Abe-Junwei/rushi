import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import type { CorrectionRulesDialogState } from "../pages/useCorrectionRulesController";
import { FloatingPanelTemplate } from "./PanelTemplate";

type Props = {
  state: CorrectionRulesDialogState;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CorrectionRulesPreviewDialog({ state, busy, onCancel, onConfirm }: Props) {
  if (state.phase === "closed" || typeof document === "undefined") return null;

  const handleClose = () => {
    if (!busy) onCancel();
  };

  const title =
    state.phase === "loading"
      ? "应用纠错规则"
      : state.phase === "empty"
        ? "应用纠错规则"
        : "纠错规则预览";

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id="correction-rules-preview-v1"
        title={title}
        preset="compactDialog"
        minWidth={400}
        minHeight={320}
        defaultSize={{ width: 520, height: 440 }}
        persistState={false}
        onClose={handleClose}
      >
        <div className="flex min-h-0 flex-1 flex-col px-5 py-3">
          {state.phase === "loading" ? (
            <p className="text-sm text-notion-text-muted">正在加载纠错记忆规则…</p>
          ) : null}
          {state.phase === "empty" ? (
            <>
              <p className="text-sm text-notion-text-muted">
                没有可用的稳定纠错规则（需 hit≥2 或已采纳），或当前语段中无匹配项。
              </p>
              <div className="mt-4 flex justify-end">
                <button type="button" className={CONTROL_BTN_SECONDARY} onClick={handleClose}>
                  关闭
                </button>
              </div>
            </>
          ) : null}
          {state.phase === "preview" ? (
            <>
              <p className="text-sm text-notion-text-muted">
                将用 {state.ruleCount} 条记忆规则更新 {state.changes.length} 条语段（字面替换，最长优先）。
              </p>
              <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto text-xs">
                {state.changes.map((ch) => (
                  <li key={ch.segmentIdx} className="rounded-md bg-notion-sidebar/80 px-3 py-2.5">
                    <p className="text-notion-text-muted">
                      <span className="font-semibold text-notion-text">语段 {ch.segmentNumber}</span>
                      <span className="mx-1.5">·</span>
                      <span className="tabular-nums">{ch.timeLabel}</span>
                      <span className="mx-1.5">·</span>
                      {ch.replacementCount} 处
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed line-through decoration-notion-text-light/50">
                      {ch.beforeText}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-notion-text">
                      {ch.afterText}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleClose}>
                  取消
                </button>
                <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirm}>
                  确认写回
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

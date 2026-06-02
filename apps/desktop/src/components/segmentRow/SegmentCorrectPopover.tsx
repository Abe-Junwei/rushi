import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { CorrectSuggestion } from "../../services/editor/correctSuggestions";
import type { SegmentCorrectPopoverState } from "../../pages/useEditorSegmentCorrectPopover";

type Props = {
  state: SegmentCorrectPopoverState | null;
  suggestions: CorrectSuggestion[];
  onClose: () => void;
  onApply: (item: CorrectSuggestion) => void;
};

export function SegmentCorrectPopover({ state, suggestions, onClose, onApply }: Props) {
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, state]);

  if (!state || typeof document === "undefined") return null;

  const left = Math.min(Math.max(8, state.clientX), window.innerWidth - 280);
  const top = Math.min(Math.max(8, state.clientY + 6), window.innerHeight - 240);

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[90] cursor-default border-0 bg-transparent p-0"
        aria-label="关闭改正建议"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="改正建议"
        className="fixed z-[91] w-[min(272px,calc(100vw-16px))] rounded-lg border border-notion-border bg-notion-bg py-1 shadow-lg"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="border-b border-notion-divider px-3 py-2 text-[11px] text-notion-text-muted">
          「{state.span.surface}」— 点击应用
        </p>
        {suggestions.length === 0 ? (
          <p className="px-3 py-3 text-xs text-notion-text-muted">无匹配建议</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto py-1">
            {suggestions.map((item, i) => (
              <li key={`${item.kind}-${i}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-notion-text transition-colors hover:bg-notion-sidebar-hover"
                  onClick={() => onApply(item)}
                >
                  {item.kind === "rule" ? (
                    <>
                      <span className="text-[11px] text-notion-text-muted">纠错记忆 · </span>
                      {item.wrong} → {item.right}
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-notion-text-muted">术语表 · </span>
                      {item.term}
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>,
    document.body,
  );
}

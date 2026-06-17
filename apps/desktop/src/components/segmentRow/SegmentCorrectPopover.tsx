import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { CorrectSuggestion } from "../../services/editor/correctSuggestions";
import type { SegmentCorrectPopoverState } from "../../pages/useEditorSegmentCorrectPopover";

function suggestionLabel(item: CorrectSuggestion): string {
  return item.kind === "rule" ? item.right : item.term;
}

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

  const popoverMaxW = 200;
  const left = Math.min(Math.max(8, state.clientX), window.innerWidth - popoverMaxW - 8);
  const top = Math.min(Math.max(8, state.clientY + 4), window.innerHeight - 120);

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
        className="fixed z-[91] w-max max-w-[min(200px,calc(100vw-16px))] rounded-md border border-notion-border bg-notion-bg py-0.5 shadow-md"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        {suggestions.length === 0 ? (
          <p className="m-0 px-2 py-1.5 text-label leading-snug text-notion-text-muted">无匹配建议</p>
        ) : (
          <ul className="m-0 max-h-40 list-none overflow-y-auto p-0" aria-label="更正建议">
            {suggestions.map((item, i) => (
              <li key={`${item.kind}-${i}`} className="list-none">
                <button
                  type="button"
                  className="block w-full border-0 bg-transparent px-2 py-1 text-left text-label leading-snug text-notion-text transition-colors hover:bg-notion-sidebar-hover"
                  title={`替换为「${suggestionLabel(item)}」`}
                  onClick={() => onApply(item)}
                >
                  <span className="text-notion-text-muted">更正建议：</span>
                  {suggestionLabel(item)}
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

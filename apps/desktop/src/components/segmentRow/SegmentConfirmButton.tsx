type Props = {
  visible: boolean;
  busy: boolean;
  onConfirm: () => void;
};

function confirmShortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl+Enter";
  return /Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘Enter" : "Ctrl+Enter";
}

/** 待确认学习：语段行右侧窄栏操作（Notion 式文字胶囊，非工具栏主按钮）。 */
export function SegmentConfirmButton({ visible, busy, onConfirm }: Props) {
  if (!visible) return null;
  const shortcut = confirmShortcutLabel();

  return (
    <button
      type="button"
      className="seg-confirm-learn-btn"
      disabled={busy}
      title={`纳入纠错记忆（${shortcut}）`}
      aria-label={`纳入纠错记忆，快捷键 ${shortcut}`}
      onClick={(e) => {
        e.stopPropagation();
        onConfirm();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="seg-confirm-learn-btn__label">纳入记忆</span>
    </button>
  );
}

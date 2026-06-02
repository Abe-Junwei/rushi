import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY } from "../config/controlStyles";
import { FloatingPanelTemplate } from "./PanelTemplate";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ROWS: { keys: string; action: string }[] = [
  { keys: "⌘/Ctrl + Enter", action: "确认改词：落库并写入纠错记忆，跳到下一语段" },
  { keys: "⌘/Ctrl + S", action: "保存语段（不计入纠错记忆）" },
  { keys: "停笔约 2s", action: "自动保存语段（仅落库，不计入纠错记忆）" },
  { keys: "⌘/Ctrl + F", action: "查找与替换" },
  { keys: "Tab / Shift+Tab", action: "在语段间前进 / 后退并联动播放" },
  { keys: "点击高亮词", action: "查看改正建议并一键替换" },
];

export function EditorShortcutsDialog({ open, onClose }: Props) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id="editor-shortcuts-v1"
        title="编辑器快捷键"
        preset="compactDialog"
        minWidth={320}
        minHeight={240}
        defaultSize={{ width: 400, height: 360 }}
        persistState={false}
        onClose={onClose}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-3">
          <p className="m-0 text-xs leading-relaxed text-notion-text-muted">
            自动保存只保证正文落库；要让手改进入「纠错记忆」，请用确认改词（右侧按钮或 ⌘/Ctrl+Enter），或使用查找替换的「全部替换」。
          </p>
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.keys} className="border-t border-notion-divider first:border-t-0">
                  <th className="w-[38%] py-2 pr-3 align-top font-mono text-[11px] font-medium text-notion-text">
                    {row.keys}
                  </th>
                  <td className="py-2 text-notion-text-muted">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-auto flex justify-end">
            <button type="button" className={CONTROL_BTN_PRIMARY} onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

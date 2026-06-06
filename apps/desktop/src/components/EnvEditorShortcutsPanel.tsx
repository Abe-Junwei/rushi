import { PANEL_TYPOGRAPHY } from "../config/typography";
import { EDITOR_FOOTER_SHORTCUT_HINTS } from "../utils/editorFooterShortcutHints";

export function EnvEditorShortcutsPanel() {
  return (
    <div className="flex max-w-[860px] flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>编辑器快捷键</h3>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.body} text-notion-text-muted`}>
          自动保存只保证正文落库；要让手改进入「纠错记忆」，请用确认改词（右侧按钮或 ⌘/Ctrl+Enter），或使用查找替换的「全部替换」。
        </p>
      </section>
      <table className={`w-full border-collapse text-left ${PANEL_TYPOGRAPHY.body}`}>
        <tbody>
          {EDITOR_FOOTER_SHORTCUT_HINTS.map((row) => (
            <tr key={row.id} className="border-t border-notion-divider first:border-t-0">
              <th className="w-[38%] py-2.5 pr-4 align-top font-mono text-[12px] font-medium text-notion-text">
                {row.keys}
              </th>
              <td className="py-2.5 text-notion-text-muted">{row.panelAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

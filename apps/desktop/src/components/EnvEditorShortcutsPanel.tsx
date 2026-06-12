import { useMemo } from "react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { formatEditorShortcutPanelSections } from "../utils/editorShortcutRegistry";

export function EnvEditorShortcutsPanel() {
  const sections = useMemo(() => formatEditorShortcutPanelSections(), []);

  return (
    <div className="flex max-w-[860px] flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>编辑器快捷键</h3>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.body} text-notion-text-muted`}>
          打开转写文件后生效。自动保存只落库正文；手改进「纠错记忆」请用定稿（⌘/Ctrl+Enter）或查找替换「全部替换」。每条组合最多
          3 键（含修饰键）。macOS 请勿使用 ⌘Space 播放（系统 Spotlight）；正文内请用 ⇧⌘Space。
        </p>
      </section>
      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h4 className={`m-0 ${PANEL_TYPOGRAPHY.body} font-medium text-notion-text`}>
            {section.title}
          </h4>
          <table className={`w-full border-collapse text-left ${PANEL_TYPOGRAPHY.body}`}>
            <tbody>
              {section.rows.map((row) => (
                <tr key={row.id} className="border-t border-notion-divider first:border-t-0">
                  <th
                    className={`w-[38%] py-2.5 pr-4 align-top ${PANEL_TYPOGRAPHY.shortcutKeys}`}
                  >
                    {row.keys}
                  </th>
                  <td className="py-2.5 text-notion-text-muted">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

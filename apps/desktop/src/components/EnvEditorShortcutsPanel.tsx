import { useMemo } from "react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { ENV_PANEL_PAGE_CLASS, ENV_PANEL_SECTION_CLASS } from "../utils/environmentPanelNav";
import { formatEditorShortcutPanelSections } from "../utils/editorShortcutRegistry";

export function EnvEditorShortcutsPanel() {
  const sections = useMemo(() => formatEditorShortcutPanelSections(), []);

  return (
    <div className={ENV_PANEL_PAGE_CLASS}>
      <section className={ENV_PANEL_SECTION_CLASS}>
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>编辑器快捷键</h3>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.body} text-notion-text-muted`}>
          打开转写文件后生效。浮动面板与确认对话框可按 Esc 关闭（处理中除外）。自动保存只落库正文；手改进「纠错记忆」请用定稿（⌘/Ctrl+Enter）或查找替换「全部替换」。每条组合最多
          3 键（含修饰键）。播放/暂停：正文外 Space；正文内 ⇧Space（裸 Space 仍输入空格）。语段正文 Tab
          仅跳段；Enter 一校并跳下一段；⌘/Ctrl+Enter 定稿并跳下一段。
        </p>
      </section>
      {sections.map((section) => (
        <section key={section.id} className={ENV_PANEL_SECTION_CLASS}>
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

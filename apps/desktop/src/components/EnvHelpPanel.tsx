import { PANEL_TYPOGRAPHY } from "../config/typography";
import { ENV_NAV } from "../config/environmentNavCopy";
import { ENV_PANEL_PAGE_CLASS, ENV_PANEL_SECTION_CLASS } from "../utils/environmentPanelNav";

export function EnvHelpPanel() {
  return (
    <div className={ENV_PANEL_PAGE_CLASS}>
      <section className={ENV_PANEL_SECTION_CLASS}>
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>转写流程</h3>
        <div className={`space-y-2 ${PANEL_TYPOGRAPHY.body}`}>
          <p className="m-0">
            工具栏选<strong className="font-medium text-notion-text"> 本机 </strong>或
            <strong className="font-medium text-notion-text"> 在线 </strong>→「
            <strong className="font-medium text-notion-text">自动转录</strong>」→ 编辑后「
            <strong className="font-medium text-notion-text">保存到 SQLite</strong>」。
          </p>
          <p className="m-0">
            <strong className="font-medium text-notion-text">本机</strong>：{ENV_NAV.localAsr} 完成准备与模型下载。
            <strong className="font-medium text-notion-text"> 在线</strong>：{ENV_NAV.onlineStt} 保存 API Key 并探测通过。
          </p>
        </div>
      </section>

      <section className={ENV_PANEL_SECTION_CLASS}>
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>推荐顺序</h3>
        <ol className={`m-0 list-inside list-decimal space-y-1.5 ${PANEL_TYPOGRAPHY.body}`}>
          <li>
            <strong className="font-medium text-notion-text">本机 ASR</strong>：侧车就绪 → 下载模型 →「应用并重启侧车」
          </li>
          <li>
            <strong className="font-medium text-notion-text">在线 STT</strong>（可选）：选厂商 → 保存 → 探测
          </li>
          <li>
            <strong className="font-medium text-notion-text">LLM</strong>（润色）：Ollama 或云端 → 保存 → 探测
          </li>
        </ol>
      </section>

      <section className={ENV_PANEL_SECTION_CLASS}>
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>常见问题</h3>
        <div className={`space-y-3 ${PANEL_TYPOGRAPHY.body}`}>
          <div>
            <h4 className={PANEL_TYPOGRAPHY.envFieldLabel}>语段有、正文为空？</h4>
            <p className="m-0 mt-1">多为 FunASR 未就绪。回 {ENV_NAV.localAsr} 完成模型与侧车准备。</p>
          </div>
          <div>
            <h4 className={PANEL_TYPOGRAPHY.envFieldLabel}>模型与侧车不一致？</h4>
            <p className="m-0 mt-1">在「转写模型」点「应用并重启侧车」，待状态条就绪后再转写。</p>
          </div>
        </div>
      </section>
    </div>
  );
}

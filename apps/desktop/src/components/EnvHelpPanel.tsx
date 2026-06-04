import { PANEL_TYPOGRAPHY } from "../config/typography";

export function EnvHelpPanel() {
  return (
    <div className="flex max-w-[860px] flex-col gap-7">
      <section className="flex flex-col gap-3">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>转写与语段</h3>
        <div className={`space-y-3 ${PANEL_TYPOGRAPHY.body}`}>
          <p className="m-0">
            打开或创建项目后，在编辑器工具栏选择<strong className="font-medium text-notion-text"> 本机 </strong>
            或<strong className="font-medium text-notion-text"> 在线 </strong>
            转写来源，再点「<strong className="font-medium text-notion-text">拉取语段</strong>
            」。语段时间与文本写入表格后，请「
            <strong className="font-medium text-notion-text">保存到 SQLite</strong>」。
          </p>
          <p className="m-0">
            <strong className="font-medium text-notion-text">本机</strong>
            走内置 ASR 侧车（默认 127.0.0.1:8741）；请先在「本机 ASR」完成一键准备、模型下载，并在状态条显示可转写。
            <strong className="font-medium text-notion-text"> 在线 </strong>
            需在「在线 STT」保存厂商配置、填写会话密钥并探测通过后使用。
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>环境准备（推荐顺序）</h3>
        <ol className={`m-0 list-inside list-decimal space-y-2 ${PANEL_TYPOGRAPHY.body}`}>
          <li>
            <strong className="font-medium text-notion-text">本机 ASR</strong>：状态条全绿或按明细修复；在「转写模型」下载并「应用并重启侧车」。
          </li>
          <li>
            <strong className="font-medium text-notion-text">在线 STT</strong>（可选）：选择厂商 → 保存 → banner「探测连接」。
          </li>
          <li>
            <strong className="font-medium text-notion-text">LLM 配置</strong>（导出润色）：本机 Ollama 或云端 API → 保存 → banner 探测/刷新。
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>常见问题</h3>
        <div className={`space-y-3 ${PANEL_TYPOGRAPHY.body}`}>
          <div>
            <h4 className={PANEL_TYPOGRAPHY.envFieldLabel}>语段有、正文为空？</h4>
            <p className="m-0 mt-1">
              多为 FunASR 未就绪或仍为 stub。回到「本机 ASR」查看状态明细，完成模型下载与侧车重启；开发环境可在「高级诊断」使用 pip 安装。
            </p>
          </div>
          <div>
            <h4 className={PANEL_TYPOGRAPHY.envFieldLabel}>所选模型与侧车不一致？</h4>
            <p className="m-0 mt-1">
              在「转写模型」点「应用并重启侧车」，待状态条「转写」行就绪后再拉取语段。
            </p>
          </div>
          <div>
            <h4 className={PANEL_TYPOGRAPHY.envFieldLabel}>更多说明</h4>
            <p className="m-0 mt-1">
              侧车与模型细节见仓库内{" "}
              <code className={PANEL_TYPOGRAPHY.code}>services/asr/README.md</code>。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

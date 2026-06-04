import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { LlmEnvMode } from "../services/llm/llmEnvStatus";
import type { LlmProviderId } from "../services/postprocess/postprocessRuntimeContract";

type Props = {
  mode: LlmEnvMode;
  disabled?: boolean;
  onSelectLocal: () => void;
  onSelectCloud: () => void;
};

export function EnvLlmModeSwitch({ mode, disabled, onSelectLocal, onSelectCloud }: Props) {
  const btn = (active: boolean) =>
    [
      "rounded-md border px-4 py-2 text-[13px] font-medium transition-colors",
      active
        ? "border-zen-saffron/50 bg-zen-saffron/10 text-notion-text"
        : "border-notion-divider bg-white text-notion-text-muted hover:bg-notion-sidebar-hover",
    ].join(" ");

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className={PANEL_TYPOGRAPHY.fieldLabel}>LLM 来源</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="LLM 来源">
        <button type="button" className={btn(mode === "local")} aria-pressed={mode === "local"} onClick={onSelectLocal}>
          本机 Ollama
        </button>
        <button type="button" className={btn(mode === "cloud")} aria-pressed={mode === "cloud"} onClick={onSelectCloud}>
          云端 API
        </button>
      </div>
      <p className={PANEL_TYPOGRAPHY.meta}>
        {mode === "local"
          ? "数据不出本机；须先安装 Ollama 并 pull 模型（推荐 qwen2.5:7b）。"
          : "连接 DeepSeek 等云端厂商；须保存 API Key 并探测连接。"}
      </p>
    </fieldset>
  );
}

export function cloudLlmProviderIds(): LlmProviderId[] {
  return ["deepseek", "kimi", "qwen", "siliconflow", "doubao", "openai", "openrouter"];
}

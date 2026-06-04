import {
  ENV_LLM_MODE_TOGGLE_TRACK,
  ENV_SEGMENTED_ROW,
  envLlmModeToggleBtnClass,
} from "../config/controlStyles";
import {
  LLM_STATUS_DOT_CLASS,
  type LlmEnvMode,
  type LlmOllamaTone,
} from "../services/llm/llmEnvStatus";
import type { LlmProviderId } from "../services/postprocess/postprocessRuntimeContract";

const LLM_MODE_TOGGLE_TONE_LABEL: Record<LlmOllamaTone, string> = {
  ok: "连接就绪",
  warn: "待验证或未就绪",
  error: "未连接或未配置",
  idle: "检测中",
};

type Props = {
  mode: LlmEnvMode;
  localTone: LlmOllamaTone;
  cloudTone: LlmOllamaTone;
  disabled?: boolean;
  onSelectLocal: () => void;
  onSelectCloud: () => void;
};

function ModeToggleLabel({ label, tone }: { label: string; tone: LlmOllamaTone }) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${LLM_STATUS_DOT_CLASS[tone]}`}
        title={LLM_MODE_TOGGLE_TONE_LABEL[tone]}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function EnvLlmModeSwitch({
  mode,
  localTone,
  cloudTone,
  disabled,
  onSelectLocal,
  onSelectCloud,
}: Props) {
  return (
    <div className={ENV_SEGMENTED_ROW}>
      <div className={ENV_LLM_MODE_TOGGLE_TRACK} role="radiogroup" aria-label="LLM 来源">
        <button
          type="button"
          role="radio"
          className={envLlmModeToggleBtnClass(mode === "local")}
          aria-checked={mode === "local"}
          aria-label={`本机 Ollama，${LLM_MODE_TOGGLE_TONE_LABEL[localTone]}`}
          disabled={disabled}
          onClick={onSelectLocal}
        >
          <ModeToggleLabel label="本机 Ollama" tone={localTone} />
        </button>
        <button
          type="button"
          role="radio"
          className={envLlmModeToggleBtnClass(mode === "cloud")}
          aria-checked={mode === "cloud"}
          aria-label={`云端 API，${LLM_MODE_TOGGLE_TONE_LABEL[cloudTone]}`}
          disabled={disabled}
          onClick={onSelectCloud}
        >
          <ModeToggleLabel label="云端 API" tone={cloudTone} />
        </button>
      </div>
    </div>
  );
}

export function cloudLlmProviderIds(): LlmProviderId[] {
  return ["deepseek", "kimi", "qwen", "siliconflow", "doubao", "openai", "openrouter"];
}

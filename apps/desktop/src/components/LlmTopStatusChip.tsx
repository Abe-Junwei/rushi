import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import { TopBarStatusIndicator } from "./TopBarStatusIndicator";

type Props = {
  refreshSeq?: number;
  onOpenLlmSettings: () => void;
  disabled?: boolean;
};

/** 顶栏 LLM 状态芯片（样式与 FFmpeg / ASR 就绪 一致） */
export function LlmTopStatusChip({ refreshSeq = 0, onOpenLlmSettings, disabled }: Props) {
  const { presentation } = useLlmEnvStatus(refreshSeq);

  return (
    <TopBarStatusIndicator
      label={presentation.chipLabel}
      ok={presentation.ok}
      disabled={disabled}
      onClick={onOpenLlmSettings}
      title={
        presentation.mode === "local"
          ? "本机 Ollama LLM 状态 · 打开 LLM 配置"
          : "云端 LLM 状态 · 打开 LLM 配置"
      }
    />
  );
}

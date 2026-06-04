import {
  ENV_LLM_MODE_TOGGLE_TRACK,
  envLlmModeToggleBtnClass,
} from "../../config/controlStyles";
import type { TranscribeSource } from "../../services/stt/transcribeSource";

type Props = {
  source: TranscribeSource;
  onlineReady: boolean;
  disabled?: boolean;
  onSelectLocal: () => void;
  onSelectOnline: () => void;
};

/** 转写来源：本机 ASR / 在线 STT（仅在实际拉取语段前选择）。 */
export function TranscribeSourceSwitch({
  source,
  onlineReady,
  disabled,
  onSelectLocal,
  onSelectOnline,
}: Props) {
  return (
    <div
      className={ENV_LLM_MODE_TOGGLE_TRACK}
      role="radiogroup"
      aria-label="转写来源"
    >
      <button
        type="button"
        role="radio"
        className={envLlmModeToggleBtnClass(source === "local")}
        aria-checked={source === "local"}
        aria-label="本机 ASR"
        disabled={disabled}
        onClick={onSelectLocal}
      >
        本机
      </button>
      <button
        type="button"
        role="radio"
        className={envLlmModeToggleBtnClass(source === "online")}
        aria-checked={source === "online"}
        aria-label="在线 STT"
        disabled={disabled || !onlineReady}
        title={onlineReady ? undefined : "请先在环境 → 在线 STT 完成配置并填写会话密钥"}
        onClick={onSelectOnline}
      >
        在线
      </button>
    </div>
  );
}

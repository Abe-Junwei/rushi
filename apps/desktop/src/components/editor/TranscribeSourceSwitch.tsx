import { ENV_NAV } from "../../config/environmentNavCopy";
import {
  ENV_LLM_MODE_TOGGLE_TRACK,
  envLlmModeToggleBtnClass,
} from "../../config/controlStyles";
import type { TranscribeSource } from "../../services/stt/transcribeSource";

const COMPACT_TOGGLE_TRACK =
  "inline-flex shrink-0 gap-0 rounded-md bg-secondary-container p-0.5";

const compactToggleBtnClass = (selected: boolean) =>
  [
    "rounded-[5px] border-0 px-2.5 py-0.5 text-center font-sans text-xs font-medium leading-none whitespace-nowrap shadow-none ring-0 transition-[color,background-color,box-shadow] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30 disabled:cursor-not-allowed disabled:opacity-40",
    selected
      ? "bg-notion-bg text-zen-saffron-mid shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      : "bg-transparent text-notion-text-variant hover:text-notion-text",
  ].join(" ");

type Props = {
  source: TranscribeSource;
  onlineReady: boolean;
  disabled?: boolean;
  /** 与 compactDialog 区块标题（12px）同排时使用 */
  compact?: boolean;
  onSelectLocal: () => void;
  onSelectOnline: () => void;
};

/** 转写来源：本机 ASR / 在线 STT（自动转录前选择）。 */
export function TranscribeSourceSwitch({
  source,
  onlineReady,
  disabled,
  compact = false,
  onSelectLocal,
  onSelectOnline,
}: Props) {
  const trackClass = compact ? COMPACT_TOGGLE_TRACK : ENV_LLM_MODE_TOGGLE_TRACK;
  const btnClass = (selected: boolean) =>
    compact ? compactToggleBtnClass(selected) : envLlmModeToggleBtnClass(selected);

  return (
    <div className={trackClass} role="radiogroup" aria-label="转写来源">
      <button
        type="button"
        role="radio"
        className={btnClass(source === "local")}
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
        className={btnClass(source === "online")}
        aria-checked={source === "online"}
        aria-label="在线 STT"
        disabled={disabled || !onlineReady}
        title={onlineReady ? undefined : `请先在「${ENV_NAV.onlineStt}」保存 API Key 并探测通过`}
        onClick={onSelectOnline}
      >
        在线
      </button>
    </div>
  );
}

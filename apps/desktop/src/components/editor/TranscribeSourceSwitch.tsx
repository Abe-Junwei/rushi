import {
  envSegmentedToggleBtnClass,
  envSegmentedToggleTrackClass,
} from "../../config/controlStyles";
import type { TranscribeSource } from "../../services/stt/transcribeSource";

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
  const trackClass = envSegmentedToggleTrackClass(compact);
  const btnClass = (selected: boolean) => envSegmentedToggleBtnClass(selected, compact);

  return (
    <div className={trackClass} role="radiogroup" aria-label="转写来源">
      <button
        type="button"
        role="radio"
        className={btnClass(source === "local")}
        aria-checked={source === "local"}
        disabled={disabled}
        onClick={onSelectLocal}
      >
        本机 ASR
      </button>
      <button
        type="button"
        role="radio"
        className={btnClass(source === "online")}
        aria-checked={source === "online"}
        disabled={disabled || !onlineReady}
        onClick={onSelectOnline}
      >
        在线 STT
      </button>
    </div>
  );
}

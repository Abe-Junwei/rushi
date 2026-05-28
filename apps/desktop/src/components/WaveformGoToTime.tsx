import { memo, useCallback, useState } from "react";

export type WaveformGoToTimeProps = {
  disabled: boolean;
  durationSec: number;
  onJump: (raw: string) => boolean;
};

/** 跳转到时间（m:ss / h:mm:ss），Enter 提交。 */
export const WaveformGoToTime = memo(function WaveformGoToTime({
  disabled,
  durationSec,
  onJump,
}: WaveformGoToTimeProps) {
  const [value, setValue] = useState("");

  const submit = useCallback(() => {
    if (disabled || !value.trim()) return;
    if (onJump(value)) {
      setValue("");
    }
  }, [disabled, onJump, value]);

  return (
    <form
      className="waveform-goto-time"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        className="waveform-goto-time-input"
        placeholder="m:ss"
        disabled={disabled || durationSec <= 0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="跳转到时间"
        title="输入 m:ss 或 h:mm:ss，按 Enter 跳转"
        autoComplete="off"
        spellCheck={false}
      />
    </form>
  );
});

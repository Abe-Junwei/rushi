import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import { TopBarStatusIndicator } from "./TopBarStatusIndicator";

type Props = {
  presentation: AsrEnvPresentation;
  onOpenAsrSettings?: () => void;
  disabled?: boolean;
};

/** 顶栏 ASR 状态芯片；FFmpeg 仅在异常时单独显示（发行包内通常随侧车就绪）。 */
export function AsrTopStatusChips({ presentation, onOpenAsrSettings, disabled }: Props) {
  return (
    <>
      {!presentation.ffmpegChipOk ? (
        <TopBarStatusIndicator
          label="FFmpeg"
          tone="error"
          title={presentation.ffmpegChipTitle}
          onClick={onOpenAsrSettings}
          disabled={disabled}
        />
      ) : null}
      <TopBarStatusIndicator
        label={presentation.chipLabel}
        tone={presentation.tone}
        title={
          onOpenAsrSettings
            ? `${presentation.chipTitle} · 打开本机 ASR 配置`
            : presentation.chipTitle
        }
        onClick={onOpenAsrSettings}
        disabled={disabled}
      />
    </>
  );
}

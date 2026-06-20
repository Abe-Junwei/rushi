import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import { TopBarStatusIndicator } from "./TopBarStatusIndicator";

type Props = {
  presentation: AsrEnvPresentation;
  onOpenAsrSettings?: () => void;
  disabled?: boolean;
  /** 追加到 tooltip，例如在线 STT 模式下说明「当前转写未使用本机 ASR」。 */
  titleContext?: string;
};

/** 顶栏 ASR 状态芯片；FFmpeg 仅在异常时单独显示（发行包内通常随侧车就绪）。 */
export function AsrTopStatusChips({
  presentation,
  onOpenAsrSettings,
  disabled,
  titleContext,
}: Props) {
  const asrTitle = onOpenAsrSettings
    ? `${presentation.chipTitle}${titleContext ? ` · ${titleContext}` : ""} · 打开本机 ASR 配置`
    : presentation.chipTitle;

  return (
    <>
      {!presentation.ffmpegChipOk ? (
        <TopBarStatusIndicator
          label="FFmpeg"
          tone="error"
          title={
            onOpenAsrSettings
              ? `${presentation.ffmpegChipTitle}${titleContext ? ` · ${titleContext}` : ""} · 打开本机 ASR 配置`
              : presentation.ffmpegChipTitle
          }
          onClick={onOpenAsrSettings}
          disabled={disabled}
        />
      ) : null}
      <TopBarStatusIndicator
        label={presentation.chipLabel}
        tone={presentation.tone}
        title={asrTitle}
        onClick={onOpenAsrSettings}
        disabled={disabled}
      />
    </>
  );
}

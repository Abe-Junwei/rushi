import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import { TopBarStatusIndicator } from "./TopBarStatusIndicator";

type Props = {
  presentation: AsrEnvPresentation;
};

/** 顶栏 FFmpeg + ASR 状态芯片（文案来自 buildAsrEnvPresentation）。 */
export function AsrTopStatusChips({ presentation }: Props) {
  return (
    <>
      <TopBarStatusIndicator
        label="FFmpeg"
        tone={presentation.ffmpegChipOk ? "ok" : "error"}
        title={presentation.ffmpegChipTitle}
      />
      <TopBarStatusIndicator
        label={presentation.chipLabel}
        tone={presentation.tone}
        title={presentation.chipTitle}
      />
    </>
  );
}

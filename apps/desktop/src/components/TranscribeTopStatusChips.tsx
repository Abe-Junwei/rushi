import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import type { TranscribeSource } from "../services/stt/transcribeSource";
import { isOnlineTranscribeReady } from "../services/stt/sttOnlineProviderContract";
import { resolveEffectiveTranscribeSource } from "../services/stt/transcribeSourcePresentation";
import { useOnlineSttTopBarPresentation } from "../hooks/useOnlineSttTopBarPresentation";
import { AsrTopStatusChips } from "./AsrTopStatusChips";
import { TopBarStatusIndicator } from "./TopBarStatusIndicator";

type Props = {
  transcribeSource: TranscribeSource;
  asrPresentation: AsrEnvPresentation;
  sttOnlineRefreshSeq?: number;
  onOpenAsrSettings?: () => void;
  onOpenOnlineSttSettings?: () => void;
  disabled?: boolean;
  /** 编辑器顶栏：就绪时隐藏芯片；欢迎页始终显示。 */
  hideWhenReady?: boolean;
};

/**
 * 顶栏转写环境芯片：在线 STT 模式下主芯片展示云端状态；本机 ASR 仍作次要参考（侧栏/切换来源时可感知）。
 */
export function TranscribeTopStatusChips({
  transcribeSource,
  asrPresentation,
  sttOnlineRefreshSeq = 0,
  onOpenAsrSettings,
  onOpenOnlineSttSettings,
  disabled,
  hideWhenReady = false,
}: Props) {
  const onlinePresentation = useOnlineSttTopBarPresentation(sttOnlineRefreshSeq);
  const asrReferenceTitle = "当前转写走在线 STT，本机 ASR 供参考";
  const effectiveSource = resolveEffectiveTranscribeSource(transcribeSource, {
    onlineReady: isOnlineTranscribeReady(),
  });

  if (effectiveSource === "online") {
    const openOnline = onOpenOnlineSttSettings ?? onOpenAsrSettings;
    const showOnlineChip = !(hideWhenReady && onlinePresentation.chipOk);
    const showAsrChip =
      Boolean(onOpenAsrSettings) &&
      !(hideWhenReady && asrPresentation.chipOk && asrPresentation.ffmpegChipOk);

    if (!showOnlineChip && !showAsrChip) return null;

    return (
      <>
        {showOnlineChip && openOnline ? (
          <TopBarStatusIndicator
            label={onlinePresentation.chipLabel}
            tone={onlinePresentation.tone}
            title={`${onlinePresentation.chipTitle} · 打开在线 STT 配置`}
            onClick={openOnline}
            disabled={disabled}
          />
        ) : null}
        {showAsrChip ? (
          <AsrTopStatusChips
            presentation={asrPresentation}
            onOpenAsrSettings={onOpenAsrSettings}
            disabled={disabled}
            titleContext={asrReferenceTitle}
          />
        ) : null}
      </>
    );
  }

  if (hideWhenReady && asrPresentation.chipOk) return null;
  if (!onOpenAsrSettings) return null;

  return (
    <AsrTopStatusChips
      presentation={asrPresentation}
      onOpenAsrSettings={onOpenAsrSettings}
      disabled={disabled}
    />
  );
}

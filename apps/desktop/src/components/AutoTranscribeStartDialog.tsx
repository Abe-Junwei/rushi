import { CONTROL_BTN_LINK, CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { TranscribeSource } from "../services/stt/transcribeSource";
import { resolveTranscribeSourceDescription } from "../services/stt/transcribeSourcePresentation";
import { TranscribeSourceSwitch } from "./editor/TranscribeSourceSwitch";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { TranscribeVocabularyPreflightLines } from "./TranscribeVocabularyPreflightLines";
import { FloatingPanelDialogHeader } from "./FloatingPanelDialogLayout";

const PANEL_ID = "auto-transcribe-start-v1";
const DEFAULT_WIDTH = 420;
const FALLBACK_HEIGHT = 268;

type Props = {
  open: boolean;
  busy: boolean;
  source: TranscribeSource;
  onlineReady: boolean;
  onSelectLocal: () => void;
  onSelectOnline: () => void;
  hasExistingSegmentText: boolean;
  segmentCount: number;
  vocabularyLines: string[];
  showOpenGlossaryLink?: boolean;
  onOpenGlossary?: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AutoTranscribeStartDialog({
  open,
  busy,
  source,
  onlineReady,
  onSelectLocal,
  onSelectOnline,
  hasExistingSegmentText,
  segmentCount,
  vocabularyLines,
  showOpenGlossaryLink = false,
  onOpenGlossary,
  onCancel,
  onConfirm,
}: Props) {
  const handleClose = () => {
    if (!busy) onCancel();
  };

  const confirmLabel = busy
    ? "转写中…"
    : hasExistingSegmentText
      ? "覆盖并开始转录"
      : "开始转录";

  const sourceDescription = resolveTranscribeSourceDescription(source, { onlineReady });
  const confirmDisabled = busy || (source === "online" && !onlineReady);

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="自动转录"
      open={open}
      onClose={handleClose}
      fallbackHeight={FALLBACK_HEIGHT}
      defaultWidth={DEFAULT_WIDTH}
      bounds={{ minWidth: 320, minHeight: 180, maxWidthCap: 480 }}
      persistState
      footer={
        <>
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleClose}>
            取消
          </button>
          <button type="button" className={CONTROL_BTN_PRIMARY} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
      footerJustify="end"
    >
      <FloatingPanelDialogHeader>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium leading-none text-notion-text">转写来源</span>
          <TranscribeSourceSwitch
            compact
            source={source}
            onlineReady={onlineReady}
            disabled={busy}
            onSelectLocal={onSelectLocal}
            onSelectOnline={onSelectOnline}
          />
        </div>
        <p className={`${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>{sourceDescription}</p>

        {hasExistingSegmentText ? (
          <p className={PANEL_TYPOGRAPHY.dialogBody}>
            已有 {segmentCount} 条语段。开始将<strong className="font-medium">覆盖</strong>
            全部正文，未保存手改会丢失，建议先保存或导出。
          </p>
        ) : (
          <p className={`${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>
            识别当前音频并写入语段。
          </p>
        )}

        {vocabularyLines.length > 0 ? (
          <>
            <TranscribeVocabularyPreflightLines lines={vocabularyLines} />
            {showOpenGlossaryLink && onOpenGlossary ? (
              <button
                type="button"
                className={`${CONTROL_BTN_LINK} text-xs font-medium text-zen-saffron`}
                disabled={busy}
                onClick={onOpenGlossary}
              >
                前往热词与记忆…
              </button>
            ) : null}
          </>
        ) : null}
      </FloatingPanelDialogHeader>
    </CompactFloatingDialog>
  );
}

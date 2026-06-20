import { CONTROL_BTN_LINK, CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import type { TranscribeSource } from "../services/stt/transcribeSource";
import { resolveTranscribeSourceDescription } from "../services/stt/transcribeSourcePresentation";
import { TranscribeSourceSwitch } from "./editor/TranscribeSourceSwitch";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { TranscribeVocabularyPreflightLines } from "./TranscribeVocabularyPreflightLines";
import { FloatingPanelDialogHeader } from "./FloatingPanelDialogLayout";
import { TRANSCRIBE_PREFLIGHT_TYPO as T } from "./transcribePreflightTypography";

const PANEL_ID = "auto-transcribe-start-v1";
const DEFAULT_WIDTH = 420;
/** 打开时占位高度（staticFit：实际高度由内容 CSS 自动贴合）。 */
const FALLBACK_HEIGHT = 200;

type Props = {
  open: boolean;
  busy: boolean;
  prepareModelBusy?: boolean;
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
  prepareModelBusy = false,
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
  const confirmDisabled =
    busy ||
    (source === "online" && !onlineReady) ||
    (source === "local" && prepareModelBusy);

  const primaryLead = hasExistingSegmentText
    ? `覆盖 ${segmentCount} 条语段并重新转写`
    : "识别当前音频并写入语段";

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="自动转录"
      open={open}
      onClose={handleClose}
      fallbackHeight={FALLBACK_HEIGHT}
      fitKind="staticFit"
      defaultWidth={DEFAULT_WIDTH}
      bounds={{ minWidth: 320, minHeight: 160, maxWidthCap: 480 }}
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
      <FloatingPanelDialogHeader className="gap-0">
        <div className={T.dialogStack}>
          <div className={T.sourceSwitchRow}>
            <TranscribeSourceSwitch
              compact
              source={source}
              onlineReady={onlineReady}
              disabled={busy}
              onSelectLocal={onSelectLocal}
              onSelectOnline={onSelectOnline}
            />
          </div>

          <div className={T.dialogSection}>
            <p className={T.primary}>{primaryLead}</p>
            <div className={T.captionStack}>
              <p className={T.body}>{sourceDescription}</p>
              {hasExistingSegmentText ? (
                <p className={T.warning}>未保存的手改会丢失，建议先保存或导出。</p>
              ) : null}
            </div>
          </div>

          {vocabularyLines.length > 0 ? (
            <>
              <TranscribeVocabularyPreflightLines lines={vocabularyLines} />
              {showOpenGlossaryLink && onOpenGlossary ? (
                <button
                  type="button"
                  className={`${CONTROL_BTN_LINK} ${T.link}`}
                  disabled={busy}
                  onClick={onOpenGlossary}
                >
                  前往热词与记忆…
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </FloatingPanelDialogHeader>
    </CompactFloatingDialog>
  );
}

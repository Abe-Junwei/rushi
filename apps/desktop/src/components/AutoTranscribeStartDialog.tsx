import { createPortal } from "react-dom";
import { CONTROL_BTN_LINK, CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { TranscribeSource } from "../services/stt/transcribeSource";
import { useFloatingPanelBodyMeasure } from "../hooks/useFloatingPanelBodyMeasure";
import { mergeContentFitHeights, resolveMeasuredPanelFitHeight } from "./floatingPanelFitSections";
import { TranscribeSourceSwitch } from "./editor/TranscribeSourceSwitch";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { FloatingPanelDialogFooter, FloatingPanelDialogRoot, FloatingPanelDialogScroll } from "./FloatingPanelDialogLayout";

const PANEL_ID = "auto-transcribe-start-v1";
const DEFAULT_SIZE = { width: 420, height: 400 } as const;
const MIN_SIZE = { width: 320, height: 320 } as const;

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
  const { bodyRef, bodyHeight } = useFloatingPanelBodyMeasure(open);

  if (!open || typeof document === "undefined") return null;

  const measuredFit = bodyHeight != null ? resolveMeasuredPanelFitHeight(bodyHeight) : null;
  const contentFitHeight = mergeContentFitHeights(DEFAULT_SIZE.height, measuredFit);

  const handleClose = () => {
    if (!busy) onCancel();
  };

  const confirmLabel = busy
    ? "转写中…"
    : hasExistingSegmentText
      ? "覆盖并开始转录"
      : "开始转录";

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id={PANEL_ID}
        title="自动转录"
        preset="compactDialog"
        minWidth={MIN_SIZE.width}
        minHeight={MIN_SIZE.height}
        maxWidth={480}
        defaultSize={{ ...DEFAULT_SIZE, height: contentFitHeight ?? DEFAULT_SIZE.height }}
        contentFitHeight={contentFitHeight}
        persistPhaseKey="default"
        persistState
        onClose={handleClose}
      >
        <FloatingPanelDialogRoot role="dialog" aria-modal="true" measureRef={bodyRef}>
          <FloatingPanelDialogScroll className="flex flex-col gap-3">
            <div>
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
            <p className={`mt-1.5 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>
              本机使用侧车 FunASR；在线使用环境页配置的云端 STT。
            </p>
          </div>

          {hasExistingSegmentText ? (
            <p className={`mt-3 ${PANEL_TYPOGRAPHY.dialogBody}`}>
              当前文件已有 {segmentCount} 条语段且含正文。开始转录将<strong className="font-medium">替换</strong>
              全部语段，未保存的手改将丢失。建议先保存或导出。
            </p>
          ) : (
            <p className={`mt-3 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>
              将对当前文件的音频执行识别并写入语段。
            </p>
          )}

          {vocabularyLines.length > 0 ? (
            <div className="mt-3 rounded-md bg-notion-sidebar/80 px-3 py-2">
              <p className="text-xs font-medium text-notion-text">本次术语偏置</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-notion-text-muted">
                {vocabularyLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {showOpenGlossaryLink && onOpenGlossary ? (
                <button
                  type="button"
                  className={`${CONTROL_BTN_LINK} mt-2 text-xs font-medium text-zen-saffron`}
                  disabled={busy}
                  onClick={onOpenGlossary}
                >
                  前往热词与记忆…
                </button>
              ) : null}
            </div>
          ) : null}
          </FloatingPanelDialogScroll>
          <FloatingPanelDialogFooter justify="end">
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleClose}>
              取消
            </button>
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </FloatingPanelDialogFooter>
        </FloatingPanelDialogRoot>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

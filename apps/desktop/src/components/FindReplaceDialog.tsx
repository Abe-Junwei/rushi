import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { FindReplaceDialogState } from "../pages/useFindReplaceController";
import { FIND_REPLACE_PANEL_ID } from "../pages/findReplaceTypes";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { FloatingPanelSegmentList } from "./FloatingPanelSegmentList";
import { FloatingPanelSegmentRow } from "./FloatingPanelSegmentRow";
import { FindReplaceMatchText } from "./FindReplaceMatchText";
import {
  FloatingPanelDialogHeader,
  FloatingPanelDialogListRegion,
} from "./FloatingPanelDialogLayout";
import {
  FindReplaceDialogBody,
  FindReplaceDialogPanelFooter,
} from "./FindReplaceDialogBody";
import {
  FIND_REPLACE_PANEL_BODY_PADDING_CLASS,
  FIND_REPLACE_PANEL_LIST_PADDING_CLASS,
  resolveFindReplacePanelBounds,
} from "./findReplacePanelLayout";

/** Bump 丢弃 flex-1 撑满 maxHeight 时代的错误 persist 高度。 */
const FIND_REPLACE_PANEL_LAYOUT_REV = 5;

const PANEL_ID = FIND_REPLACE_PANEL_ID;

/** 打开时占位高度（autoFit：实际高度由内容贴合）。 */
const FIND_REPLACE_DEFAULT_HEIGHT = 360;

type Props = {
  state: FindReplaceDialogState;
  busy: boolean;
  onClose: () => void;
  onFindChange: (value: string) => void;
  onReplaceChange: (value: string) => void;
  onRunSearch: () => void;
  onSelectMatch: (globalIndex: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onReplaceCurrent: () => void;
  onReplaceAndNext: () => void;
  onRequestReplaceAll: () => void;
  onConfirmReplaceAll: () => void;
  onCancelReplaceAllPreview: () => void;
};

export function FindReplaceDialog({
  state,
  busy,
  onClose,
  onFindChange,
  onReplaceChange,
  onRunSearch,
  onSelectMatch,
  onPrev,
  onNext,
  onReplaceCurrent,
  onReplaceAndNext,
  onRequestReplaceAll,
  onConfirmReplaceAll,
  onCancelReplaceAllPreview,
}: Props) {
  const isOpen = state.phase !== "closed";
  const isPreview = state.phase === "replaceAllPreview";
  const bounds = resolveFindReplacePanelBounds();

  const handleClose = () => {
    if (!busy) onClose();
  };

  const panelCanAct =
    state.phase === "panel" && state.searchCommitted && state.matchCount > 0 && !busy;

  return (
    <CompactFloatingDialog
      id={isPreview ? `${PANEL_ID}-preview` : PANEL_ID}
      title={isPreview ? "全部替换预览" : "查找替换"}
      open={isOpen}
      onClose={handleClose}
      fitKind="autoFit"
      shellPreset="findReplace"
      fallbackHeight={FIND_REPLACE_DEFAULT_HEIGHT}
      persistPhaseKey={isPreview ? "preview" : "panel"}
      layoutRev={FIND_REPLACE_PANEL_LAYOUT_REV}
      persistState
      minWidth={bounds.minWidth}
      maxWidth={bounds.maxWidth}
      maxHeight={bounds.maxHeight}
      defaultWidth={isPreview ? bounds.previewWidth : bounds.defaultWidth}
      rootClassName="gap-0 !p-0"
      footerFullBleed
      footerClassName="!px-3"
      footerJustify={isPreview ? "end" : "between"}
      footer={
        isPreview ? (
          <>
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={busy}
              onClick={onCancelReplaceAllPreview}
            >
              返回
            </button>
            <button
              type="button"
              className={CONTROL_BTN_PRIMARY}
              disabled={busy}
              onClick={() => void onConfirmReplaceAll()}
            >
              确认替换并保存
            </button>
          </>
        ) : (
          <FindReplaceDialogPanelFooter
            canAct={panelCanAct}
            onReplaceCurrent={onReplaceCurrent}
            onReplaceAndNext={onReplaceAndNext}
            onRequestReplaceAll={onRequestReplaceAll}
          />
        )
      }
    >
      {isPreview && state.phase === "replaceAllPreview" ? (
        <>
          <FloatingPanelDialogHeader className={FIND_REPLACE_PANEL_BODY_PADDING_CLASS}>
            <p className={PANEL_TYPOGRAPHY.dialogBody}>
              将替换 {state.matchCount} 处「{state.findText}」→「{state.replaceText || "（空）"}」。确认后将自动保存并写入纠错记忆（查找词与替换词不同时）。
            </p>
          </FloatingPanelDialogHeader>
          <FloatingPanelDialogListRegion
            fitToContent
            className={FIND_REPLACE_PANEL_LIST_PADDING_CLASS}
          >
            <FloatingPanelSegmentList rowCount={state.rows.length}>
              {state.rows.map((row) => (
                <li key={`${row.segmentIdx}-${row.globalIndex}`} className="list-none">
                  <FloatingPanelSegmentRow
                    segmentNumber={row.segmentNumber}
                    timeLabel={row.startTimeLabel}
                    suffix={`#${row.globalIndex + 1}`}
                  >
                    <FindReplaceMatchText
                      variant="inline"
                      text={row.fullText}
                      charStart={row.charStart}
                      charEnd={row.charEnd}
                    />
                  </FloatingPanelSegmentRow>
                </li>
              ))}
            </FloatingPanelSegmentList>
          </FloatingPanelDialogListRegion>
        </>
      ) : state.phase === "panel" ? (
        <FindReplaceDialogBody
          state={state}
          busy={busy}
          onFindChange={onFindChange}
          onReplaceChange={onReplaceChange}
          onRunSearch={onRunSearch}
          onSelectMatch={onSelectMatch}
          onPrev={onPrev}
          onNext={onNext}
          onReplaceCurrent={onReplaceCurrent}
          onReplaceAndNext={onReplaceAndNext}
        />
      ) : null}
    </CompactFloatingDialog>
  );
}

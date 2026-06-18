import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { FindReplaceDialogState } from "../pages/useFindReplaceController";
import { FIND_REPLACE_PANEL_ID } from "../pages/findReplaceTypes";
import { FloatingPanelSegmentList } from "./FloatingPanelSegmentList";
import {
  FIND_REPLACE_PANEL_STATIC_BODY_PX,
  FIND_REPLACE_PREVIEW_STATIC_BODY_PX,
  resolveFloatingPanelFitHeight,
} from "./floatingPanelSegmentListLayout";
import { FloatingPanelSegmentRow } from "./FloatingPanelSegmentRow";
import { FindReplaceMatchText } from "./FindReplaceMatchText";
import { readFloatingPanelViewport } from "./floatingPanelViewport";
import { FloatingPanelTemplate } from "./PanelTemplate";
import {
  FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS,
  FloatingPanelDialogFooter,
  FloatingPanelDialogHeader,
  FloatingPanelDialogListRegion,
  FloatingPanelDialogRoot,
} from "./FloatingPanelDialogLayout";
import { FindReplaceDialogBody } from "./FindReplaceDialogBody";
import { useFloatingPanelBodyMeasure } from "../hooks/useFloatingPanelBodyMeasure";
import { mergeContentFitHeights, resolveMeasuredPanelFitHeight } from "./floatingPanelFitSections";

const PANEL_ID = FIND_REPLACE_PANEL_ID;

/** 按当前视口测算，避免 compactDialog 320×200 上限与编辑区工具栏遮挡。 */
function resolveFindReplacePanelLayout() {
  const viewport = readFloatingPanelViewport();
  const margin = 16;
  const maxW = Math.min(640, Math.max(320, viewport.width - margin * 2));
  const maxH = Math.min(720, Math.max(280, viewport.height - margin * 2));
  return {
    defaultSize: {
      width: Math.min(480, maxW),
      height: Math.min(400, maxH),
    },
    minWidth: Math.min(400, maxW),
    minHeight: Math.min(300, maxH),
    maxWidth: maxW,
    maxHeight: maxH,
  };
}

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
  const isOpen = state.phase !== "closed" && typeof document !== "undefined";
  const { bodyRef, bodyHeight } = useFloatingPanelBodyMeasure(isOpen);

  if (!isOpen) return null;

  const handleClose = () => {
    if (!busy) onClose();
  };

  const measuredFit = bodyHeight != null ? resolveMeasuredPanelFitHeight(bodyHeight) : null;

  if (state.phase === "replaceAllPreview") {
    const layout = resolveFindReplacePanelLayout();
    const previewFitHeight = resolveFloatingPanelFitHeight(
      FIND_REPLACE_PREVIEW_STATIC_BODY_PX,
      state.rows.length,
    );
    const contentFitHeight = mergeContentFitHeights(previewFitHeight, measuredFit);
    const defaultPanelHeight = Math.min(contentFitHeight ?? previewFitHeight, layout.maxHeight);

    return createPortal(
      <div className="workspace">
        <FloatingPanelTemplate
          id={`${PANEL_ID}-preview`}
          title="全部替换预览"
          preset="findReplace"
          minWidth={layout.minWidth}
          minHeight={Math.min(400, layout.maxHeight)}
          maxWidth={layout.maxWidth}
          maxHeight={layout.maxHeight}
          defaultSize={{
            width: Math.min(520, layout.maxWidth),
            height: defaultPanelHeight,
          }}
          contentFitHeight={contentFitHeight}
          layoutRev={state.rows.length}
          panelZIndex={110}
          persistState
          onClose={handleClose}
        >
          <FloatingPanelDialogRoot measureRef={bodyRef} hasFooter fillHeight className="gap-0 p-0">
            <div className={`flex min-h-0 flex-1 flex-col gap-2 overflow-hidden ${FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS}`}>
            <FloatingPanelDialogHeader>
              <p className={PANEL_TYPOGRAPHY.dialogBody}>
                将替换 {state.matchCount} 处「{state.findText}」→「{state.replaceText || "（空）"}」。确认后将自动保存并写入纠错记忆（查找词与替换词不同时）。
              </p>
            </FloatingPanelDialogHeader>
            <FloatingPanelDialogListRegion className="min-h-[8rem]">
              <FloatingPanelSegmentList rowCount={state.rows.length} fillAvailable>
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
            </div>
            <FloatingPanelDialogFooter fullBleed justify="end">
              <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onCancelReplaceAllPreview}>
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
            </FloatingPanelDialogFooter>
          </FloatingPanelDialogRoot>
        </FloatingPanelTemplate>
      </div>,
      document.body,
    );
  }

  const layout = resolveFindReplacePanelLayout();
  const matchRowCount = state.searchCommitted && state.matchCount > 0 ? state.matchCount : 0;
  const panelFitHeight = resolveFloatingPanelFitHeight(FIND_REPLACE_PANEL_STATIC_BODY_PX, matchRowCount);
  const contentFitHeight = mergeContentFitHeights(panelFitHeight, measuredFit);
  const defaultPanelHeight = Math.min(contentFitHeight ?? panelFitHeight, layout.maxHeight);
  const layoutRev = matchRowCount + (state.searchCommitted ? 2000 : 0);

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id={PANEL_ID}
        title="查找替换"
        preset="findReplace"
        minWidth={layout.minWidth}
        minHeight={layout.minHeight}
        maxWidth={layout.maxWidth}
        maxHeight={layout.maxHeight}
        defaultSize={{
          width: layout.defaultSize.width,
          height: defaultPanelHeight,
        }}
        contentFitHeight={contentFitHeight}
        layoutRev={layoutRev}
        panelZIndex={110}
        persistState
        onClose={handleClose}
      >
        <FindReplaceDialogBody
          state={state}
          busy={busy}
          measureRef={bodyRef}
          onFindChange={onFindChange}
          onReplaceChange={onReplaceChange}
          onRunSearch={onRunSearch}
          onSelectMatch={onSelectMatch}
          onPrev={onPrev}
          onNext={onNext}
          onReplaceCurrent={onReplaceCurrent}
          onReplaceAndNext={onReplaceAndNext}
          onRequestReplaceAll={onRequestReplaceAll}
        />
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

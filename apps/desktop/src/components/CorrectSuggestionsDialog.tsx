import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { CorrectSuggestionsDialogState } from "../pages/useCorrectSuggestionsController";
import type { CorrectSuggestion } from "../services/editor/correctSuggestions";
import { useFloatingPanelBodyMeasure } from "../hooks/useFloatingPanelBodyMeasure";
import {
  CORRECT_SUGGESTIONS_EMPTY_STATIC_BODY_PX,
  CORRECT_SUGGESTIONS_LOADING_BODY_PX,
  FLOATING_PANEL_COMPACT_MIN_HEIGHT,
  resolveCorrectSuggestionsResultsFitHeight,
  resolveFloatingPanelCompactFitHeight,
} from "./floatingPanelSegmentListLayout";
import { mergeContentFitHeights, resolveMeasuredPanelFitHeight } from "./floatingPanelFitSections";
import { PanelAsyncProgress } from "./PanelAsyncProgress";
import { FloatingPanelTemplate } from "./PanelTemplate";
import {
  FloatingPanelDialogFooter,
  FloatingPanelDialogHeader,
  FloatingPanelDialogListRegion,
  FloatingPanelDialogRoot,
  FloatingPanelDialogScroll,
} from "./FloatingPanelDialogLayout";
import { FloatingPanelSegmentList } from "./FloatingPanelSegmentList";

type Props = {
  state: CorrectSuggestionsDialogState;
  onCancel: () => void;
  onApply: (item: CorrectSuggestion) => void;
  onOpenFindReplace: () => void;
};

export function CorrectSuggestionsDialog({ state, onCancel, onApply, onOpenFindReplace }: Props) {
  const isOpen = state.phase !== "closed" && typeof document !== "undefined";
  const { bodyRef, bodyHeight } = useFloatingPanelBodyMeasure(isOpen);

  if (!isOpen) return null;

  const isLoading = state.phase === "loading";
  const isEmpty = state.phase === "empty";
  const isResults = state.phase === "results";
  const isCompactBody = isLoading || isEmpty;

  const estimatedFit = isLoading
    ? resolveFloatingPanelCompactFitHeight(CORRECT_SUGGESTIONS_LOADING_BODY_PX)
    : isEmpty
      ? resolveFloatingPanelCompactFitHeight(CORRECT_SUGGESTIONS_EMPTY_STATIC_BODY_PX)
      : isResults
        ? resolveCorrectSuggestionsResultsFitHeight(state.items.length)
        : undefined;

  const measuredFit = bodyHeight != null ? resolveMeasuredPanelFitHeight(bodyHeight) : null;
  const contentFitHeight = mergeContentFitHeights(estimatedFit, measuredFit);
  const defaultPanelHeight = contentFitHeight ?? 360;
  const persistPhaseKey = state.phase;

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id="correct-suggestions-v1"
        title="改正建议"
        preset="compactDialog"
        minWidth={360}
        minHeight={isCompactBody ? FLOATING_PANEL_COMPACT_MIN_HEIGHT : 280}
        defaultSize={{ width: 420, height: defaultPanelHeight }}
        contentFitHeight={contentFitHeight}
        persistPhaseKey={persistPhaseKey}
        maxWidth={520}
        persistState
        onClose={onCancel}
      >
        <FloatingPanelDialogRoot measureRef={bodyRef}>
          {state.phase === "loading" ? (
            <PanelAsyncProgress mode="spinner" message="正在匹配术语表与纠错记忆…" />
          ) : null}
          {state.phase === "empty" ? (
            <>
              <FloatingPanelDialogScroll>
                <p className={PANEL_TYPOGRAPHY.dialogBody}>
                  选中「{state.selection}」在术语表与纠错记忆中没有字面匹配项。可手动在语段中修改，或使用查找替换批量处理。
                </p>
              </FloatingPanelDialogScroll>
              <FloatingPanelDialogFooter justify="start">
                <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onOpenFindReplace}>
                  打开查找替换…
                </button>
                <button type="button" className={CONTROL_BTN_PRIMARY} onClick={onCancel}>
                  关闭
                </button>
              </FloatingPanelDialogFooter>
            </>
          ) : null}
          {state.phase === "results" ? (
            <>
              <FloatingPanelDialogHeader>
                <p className="text-xs text-notion-text-muted">
                  选中：「{state.selection}」— 仅字面匹配，不猜谐音
                </p>
              </FloatingPanelDialogHeader>
              <FloatingPanelDialogListRegion className="mt-3">
                <FloatingPanelSegmentList rowCount={state.items.length} fillAvailable>
                  {state.items.map((item, i) => (
                    <li key={`${item.kind}-${i}`} className="list-none">
                      <button
                        type="button"
                        className="w-full rounded-md bg-notion-sidebar/80 px-3 py-2.5 text-left transition-colors hover:bg-notion-sidebar-hover"
                        onClick={() => onApply(item)}
                      >
                        {item.kind === "rule" ? (
                          <>
                            <p className="text-xs font-medium text-notion-text">纠错记忆</p>
                            <p className={`mt-1 ${PANEL_TYPOGRAPHY.dialogText}`}>
                              {item.wrong} → {item.right}
                            </p>
                            <p className="mt-0.5 text-xs text-notion-text-muted">
                              hit {item.hitCount}
                              {item.acceptedAsRule ? " · 已采纳" : ""}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-medium text-notion-text">术语表</p>
                            <p className={`mt-1 ${PANEL_TYPOGRAPHY.dialogText}`}>{item.term}</p>
                            {item.aliases ? (
                              <p className="mt-0.5 text-xs text-notion-text-muted">别名：{item.aliases}</p>
                            ) : null}
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </FloatingPanelSegmentList>
              </FloatingPanelDialogListRegion>
              <FloatingPanelDialogFooter justify="end">
                <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onCancel}>
                  关闭
                </button>
              </FloatingPanelDialogFooter>
            </>
          ) : null}
        </FloatingPanelDialogRoot>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

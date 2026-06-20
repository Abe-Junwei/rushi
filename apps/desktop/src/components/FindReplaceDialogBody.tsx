import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import type { FindReplaceDialogState } from "../pages/useFindReplaceController";
import { matchPositionLabel } from "../services/editor/segmentFindReplace";
import { FloatingPanelSegmentList } from "./FloatingPanelSegmentList";
import { FloatingPanelSegmentRow } from "./FloatingPanelSegmentRow";
import { FindReplaceMatchText } from "./FindReplaceMatchText";
import {
  FIND_REPLACE_PANEL_BODY_PADDING_CLASS,
  FIND_REPLACE_PANEL_LIST_PADDING_CLASS,
} from "./findReplacePanelLayout";
import {
  FloatingPanelDialogHeader,
  FloatingPanelDialogListRegion,
} from "./FloatingPanelDialogLayout";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const fieldClass = `${CONTROL_TEXT_INPUT} min-w-0 px-2.5 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`;

/** VS Code 式查找条：输入框 + 尾部图标操作，与替换框同宽。 */
const findBarActionClass =
  "inline-flex h-full w-8 shrink-0 items-center justify-center border-l border-notion-divider bg-notion-bg text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:opacity-40";

type PanelState = Extract<FindReplaceDialogState, { phase: "panel" }>;

function FindResultList({
  items,
  activeMatchIndex,
  onSelectMatch,
}: {
  items: PanelState["resultItems"];
  activeMatchIndex: number;
  onSelectMatch: (globalIndex: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <FloatingPanelSegmentList rowCount={items.length}>
      {items.map((item) => {
        const active = item.globalIndex === activeMatchIndex;
        return (
          <li key={`${item.segmentIdx}-${item.globalIndex}`} className="list-none">
            <FloatingPanelSegmentRow
              segmentNumber={item.segmentNumber}
              timeLabel={item.startTimeLabel}
              suffix={`#${item.globalIndex + 1}`}
              active={active}
              onClick={() => onSelectMatch(item.globalIndex)}
            >
              <FindReplaceMatchText
                variant="inline"
                text={item.fullText}
                charStart={item.charStart}
                charEnd={item.charEnd}
              />
            </FloatingPanelSegmentRow>
          </li>
        );
      })}
    </FloatingPanelSegmentList>
  );
}

export type FindReplaceDialogBodyProps = {
  state: PanelState;
  busy: boolean;
  onFindChange: (value: string) => void;
  onReplaceChange: (value: string) => void;
  onRunSearch: () => void;
  onSelectMatch: (globalIndex: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onReplaceCurrent: () => void;
  onReplaceAndNext: () => void;
};

export function FindReplaceDialogPanelFooter({
  canAct,
  onReplaceCurrent,
  onReplaceAndNext,
  onRequestReplaceAll,
}: {
  canAct: boolean;
  onReplaceCurrent: () => void;
  onReplaceAndNext: () => void;
  onRequestReplaceAll: () => void;
}) {
  return (
    <>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={!canAct}
          title="⌘Enter 替换当前"
          onClick={onReplaceCurrent}
        >
          替换当前
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={!canAct}
          title="Enter 替换并下一处"
          onClick={onReplaceAndNext}
        >
          替换并下一处
        </button>
      </div>
      <button
        type="button"
        className={[CONTROL_BTN_PRIMARY, "shrink-0"].join(" ")}
        disabled={!canAct}
        onClick={onRequestReplaceAll}
      >
        全部替换…
      </button>
    </>
  );
}

export function FindReplaceDialogBody({
  state,
  busy,
  onFindChange,
  onReplaceChange,
  onRunSearch,
  onSelectMatch,
  onPrev,
  onNext,
  onReplaceCurrent,
  onReplaceAndNext,
}: FindReplaceDialogBodyProps) {
  const position = state.searchCommitted
    ? matchPositionLabel(state.matchCount, state.activeMatchIndex)
    : "尚未查找";
  const canSearch = state.findText.length > 0 && !busy;
  const canAct = state.searchCommitted && state.matchCount > 0 && !busy;

  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || busy) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod) {
      if (!canAct) return;
      e.preventDefault();
      onReplaceCurrent();
      return;
    }
    if (e.shiftKey) {
      if (!state.searchCommitted || !canAct) return;
      e.preventDefault();
      onPrev();
      return;
    }
    e.preventDefault();
    if (!state.searchCommitted) {
      if (canSearch) onRunSearch();
      return;
    }
    if (canAct) onReplaceAndNext();
  };

  return (
    <>
      <FloatingPanelDialogHeader className={FIND_REPLACE_PANEL_BODY_PADDING_CLASS}>
        <div className="shrink-0 space-y-3" onKeyDown={handlePanelKeyDown}>
          <div className="grid gap-1">
            <label htmlFor="find-replace-find-input" className="text-xs text-notion-text-muted">
              查找
            </label>
            <div className="flex h-8 overflow-hidden rounded-sm border border-notion-divider bg-notion-bg focus-within:border-accent-action/45">
              <input
                id="find-replace-find-input"
                className={`min-w-0 flex-1 border-0 bg-transparent px-2.5 outline-none ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
                value={state.findText}
                disabled={busy}
                onChange={(e) => onFindChange(e.target.value)}
                onKeyDown={handlePanelKeyDown}
                autoFocus
              />
              <button
                type="button"
                className={findBarActionClass}
                title="查找"
                aria-label="查找"
                disabled={!canSearch}
                onClick={onRunSearch}
              >
                <Search className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              </button>
              <button
                type="button"
                className={findBarActionClass}
                title="上一处 (Shift+Enter)"
                aria-label="上一处"
                disabled={!canAct}
                onClick={onPrev}
              >
                <ChevronUp className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              </button>
              <button
                type="button"
                className={findBarActionClass}
                title="下一处"
                aria-label="下一处"
                disabled={!canAct}
                onClick={onNext}
              >
                <ChevronDown className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              </button>
            </div>
          </div>
          <label className="grid gap-1 text-xs text-notion-text-muted">
            <span>替换为（可留空）</span>
            <input
              id="find-replace-replace-input"
              className={fieldClass}
              value={state.replaceText}
              disabled={busy}
              onChange={(e) => onReplaceChange(e.target.value)}
              onKeyDown={handlePanelKeyDown}
            />
          </label>
        </div>
        <p className={`shrink-0 text-xs tabular-nums text-notion-text-muted ${PANEL_TYPOGRAPHY.dialogBody}`}>
          {position}
          {state.searchCommitted && state.matchCount > 0 ? " · 点击行定位语段" : null}
        </p>
        {state.searchCommitted && state.matchCount === 0 ? (
          <p className={`shrink-0 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>
            未找到匹配「{state.findText}」的语段。
          </p>
        ) : null}
      </FloatingPanelDialogHeader>
      {state.searchCommitted && state.matchCount > 0 ? (
        <FloatingPanelDialogListRegion fitToContent className={FIND_REPLACE_PANEL_LIST_PADDING_CLASS}>
          <FindResultList
            items={state.resultItems}
            activeMatchIndex={state.activeMatchIndex}
            onSelectMatch={onSelectMatch}
          />
        </FloatingPanelDialogListRegion>
      ) : null}
    </>
  );
}

import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import type { FindReplaceDialogState } from "../pages/useFindReplaceController";
import { FIND_REPLACE_PANEL_ID } from "../pages/findReplaceTypes";
import { matchPositionLabel } from "../services/editor/segmentFindReplace";
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
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

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
    minWidth: Math.min(360, maxW),
    minHeight: Math.min(300, maxH),
    maxWidth: maxW,
    maxHeight: maxH,
  };
}

const fieldClass =
  `h-8 min-w-0 w-full rounded-md border border-notion-divider bg-notion-bg px-2.5 outline-none focus:border-zen-saffron/45 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`;

/** VS Code 式查找条：输入框 + 尾部图标操作，与替换框同宽。 */
const findBarActionClass =
  "inline-flex h-full w-8 shrink-0 items-center justify-center border-l border-notion-divider bg-notion-bg text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:opacity-40";

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

function FindResultList({
  items,
  activeMatchIndex,
  onSelectMatch,
}: {
  items: Extract<FindReplaceDialogState, { phase: "panel" }>["resultItems"];
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
  if (state.phase === "closed" || typeof document === "undefined") return null;

  const handleClose = () => {
    if (!busy) onClose();
  };

  if (state.phase === "replaceAllPreview") {
    const layout = resolveFindReplacePanelLayout();
    const previewFitHeight = resolveFloatingPanelFitHeight(
      FIND_REPLACE_PREVIEW_STATIC_BODY_PX,
      state.rows.length,
    );
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
            height: Math.min(previewFitHeight, layout.maxHeight),
          }}
          contentFitHeight={previewFitHeight}
          panelZIndex={110}
          persistState
          onClose={handleClose}
        >
          <div className="flex flex-col px-5 py-3">
            <p className={PANEL_TYPOGRAPHY.dialogBody}>
              将替换 {state.matchCount} 处「{state.findText}」→「{state.replaceText || "（空）"}」。确认后将自动保存并写入纠错记忆（查找词与替换词不同时）。
            </p>
            <FloatingPanelSegmentList rowCount={state.rows.length} className="mt-3">
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
            <div className="mt-3 flex justify-start gap-2">
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
            </div>
          </div>
        </FloatingPanelTemplate>
      </div>,
      document.body,
    );
  }

  const position = state.searchCommitted
    ? matchPositionLabel(state.matchCount, state.activeMatchIndex)
    : "尚未查找";
  const canSearch = state.findText.length > 0 && !busy;
  const canAct = state.searchCommitted && state.matchCount > 0 && !busy;

  const layout = resolveFindReplacePanelLayout();
  const matchRowCount = state.searchCommitted && state.matchCount > 0 ? state.matchCount : 0;
  const panelFitHeight = resolveFloatingPanelFitHeight(FIND_REPLACE_PANEL_STATIC_BODY_PX, matchRowCount);

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
          height: Math.min(panelFitHeight, layout.maxHeight),
        }}
        contentFitHeight={panelFitHeight}
        panelZIndex={110}
        persistState
        onClose={handleClose}
      >
        <div className="flex flex-col gap-2 px-5 py-3" onKeyDown={handlePanelKeyDown}>
          <div className="shrink-0 space-y-3">
            <div className="grid gap-1">
              <label htmlFor="find-replace-find-input" className="text-xs text-notion-text-muted">
                查找
              </label>
              <div className="flex h-8 overflow-hidden rounded-md border border-notion-divider bg-notion-bg focus-within:border-zen-saffron/45">
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
          {state.searchCommitted && state.matchCount > 0 ? (
            <FindResultList
              items={state.resultItems}
              activeMatchIndex={state.activeMatchIndex}
              onSelectMatch={onSelectMatch}
            />
          ) : null}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-notion-divider pt-3">
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
            <button
              type="button"
              className={[CONTROL_BTN_PRIMARY, "ml-auto"].join(" ")}
              disabled={!canAct}
              onClick={onRequestReplaceAll}
            >
              全部替换…
            </button>
          </div>
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

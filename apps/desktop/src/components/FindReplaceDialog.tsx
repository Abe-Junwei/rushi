import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import type { FindReplaceDialogState } from "../pages/useFindReplaceController";
import { matchPositionLabel } from "../services/editor/segmentFindReplace";
import { FindReplaceMatchText } from "./FindReplaceMatchText";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const PANEL_ID = "find-replace-v2";

/** 按当前视口测算，避免 compactDialog 320×200 上限与编辑区工具栏遮挡。 */
function resolveFindReplacePanelLayout() {
  const vw = Math.floor(window.visualViewport?.width ?? window.innerWidth);
  const vh = Math.floor(window.visualViewport?.height ?? window.innerHeight);
  const margin = 16;
  const maxW = Math.min(640, Math.max(320, vw - margin * 2));
  const maxH = Math.min(720, Math.max(280, vh - margin * 2));
  return {
    defaultSize: {
      width: Math.min(480, maxW),
      height: Math.min(520, maxH),
    },
    minWidth: Math.min(360, maxW),
    minHeight: Math.min(320, maxH),
    maxWidth: maxW,
    maxHeight: maxH,
  };
}

const fieldClass =
  `h-8 min-w-0 flex-1 rounded-md border border-notion-divider bg-notion-bg px-2.5 outline-none focus:border-zen-saffron/45 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`;

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

const RESULT_LIST_CLASS =
  "mt-2 min-h-0 flex-1 list-none overflow-y-auto rounded-md border border-notion-divider bg-notion-bg p-0 m-0 divide-y divide-notion-divider";

const RESULT_ROW_CLASS =
  "w-full border-0 px-3 py-2 text-left transition-colors select-text";

/** Inline + middot：避免 flex baseline 与 semibold/tabular-nums 错位 */
function FindResultMetaLine({
  segmentNumber,
  timeLabel,
  matchOrdinal,
}: {
  segmentNumber: number;
  timeLabel: string;
  matchOrdinal?: number;
}) {
  return (
    <p className="m-0 text-xs leading-4 text-notion-text-muted">
      <span className="font-medium text-notion-text">语段 {segmentNumber}</span>
      <span className="px-1.5 text-notion-text-light" aria-hidden>
        ·
      </span>
      <span className="tabular-nums">{timeLabel}</span>
      {matchOrdinal !== undefined ? (
        <>
          <span className="px-1.5 text-notion-text-light" aria-hidden>
            ·
          </span>
          <span>第 {matchOrdinal} 处</span>
        </>
      ) : null}
    </p>
  );
}

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
    <ul className={RESULT_LIST_CLASS}>
      {items.map((item) => {
        const active = item.globalIndex === activeMatchIndex;
        return (
          <li key={`${item.segmentIdx}-${item.globalIndex}`} className="list-none">
            <button
              type="button"
              className={[
                RESULT_ROW_CLASS,
                active ? "bg-notion-sidebar-active" : "bg-transparent hover:bg-notion-sidebar-hover",
              ].join(" ")}
              onClick={() => onSelectMatch(item.globalIndex)}
            >
              <FindResultMetaLine
                segmentNumber={item.segmentNumber}
                timeLabel={item.timeLabel}
                matchOrdinal={item.globalIndex + 1}
              />
              <div className="mt-1">
                <FindReplaceMatchText text={item.fullText} charStart={item.charStart} charEnd={item.charEnd} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
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
            height: Math.min(480, layout.maxHeight),
          }}
          panelZIndex={110}
          persistState
          onClose={handleClose}
        >
          <div className="flex min-h-0 flex-1 flex-col px-5 py-3">
            <p className={PANEL_TYPOGRAPHY.dialogBody}>
              将替换 {state.matchCount} 处「{state.findText}」→「{state.replaceText || "（空）"}」。确认后将自动保存并写入纠错记忆（查找词与替换词不同时）。
            </p>
            <ul className={`${RESULT_LIST_CLASS} mt-3 text-xs`}>
              {state.rows.map((row) => (
                <li key={`${row.segmentIdx}-${row.globalIndex}`} className="list-none px-3 py-2 text-notion-text-muted">
                  <p className="m-0 text-xs leading-4 text-notion-text-muted">
                    <span className="font-medium text-notion-text">{row.label}</span>
                    <span className="px-1.5 text-notion-text-light" aria-hidden>
                      ·
                    </span>
                    <span className="tabular-nums">{row.timeLabel}</span>
                  </p>
                  <div className="mt-1.5">
                    <p className="mb-0.5 text-[11px] uppercase tracking-wide text-notion-text-light">改前</p>
                    <p className={`whitespace-pre-wrap break-words ${PANEL_TYPOGRAPHY.dialogBody} leading-snug line-through decoration-notion-text-light/50`}>
                      {row.fullText}
                    </p>
                  </div>
                  <div className="mt-1.5">
                    <p className="mb-0.5 text-[11px] uppercase tracking-wide text-notion-text-light">改后</p>
                    <p className={`whitespace-pre-wrap break-words ${PANEL_TYPOGRAPHY.dialogText} leading-snug`}>
                      {row.fullTextAfter}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
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
  const activeItem =
    state.activeMatchIndex >= 0
      ? state.resultItems.find((r) => r.globalIndex === state.activeMatchIndex)
      : state.resultItems[0];

  const layout = resolveFindReplacePanelLayout();

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
        defaultSize={layout.defaultSize}
        panelZIndex={110}
        persistState
        onClose={handleClose}
      >
        <div
          className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-3"
          onKeyDown={(e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (mod && e.key === "Enter" && canAct) {
              e.preventDefault();
              onReplaceAndNext();
            }
          }}
        >
          <label className="grid gap-1 text-xs text-notion-text-muted">
            <span>查找</span>
            <div className="flex gap-2">
              <input
                id="find-replace-find-input"
                className={fieldClass}
                value={state.findText}
                disabled={busy}
                onChange={(e) => onFindChange(e.target.value)}
                onBlur={() => {
                  if (state.findText.length > 0) onRunSearch();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!state.searchCommitted) onRunSearch();
                    else onNext();
                  }
                  if (e.key === "Enter" && e.shiftKey) {
                    e.preventDefault();
                    if (state.searchCommitted) onPrev();
                  }
                }}
                placeholder="区分大小写，字面匹配"
                autoFocus
              />
              <button
                type="button"
                className={[
                  CONTROL_BTN_PRIMARY,
                  "inline-flex shrink-0 items-center gap-1.5 px-3",
                  !canSearch ? "opacity-40" : "",
                ].join(" ")}
                disabled={!canSearch}
                onClick={onRunSearch}
              >
                <Search className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                查找
              </button>
            </div>
          </label>
          <label className="grid gap-1 text-xs text-notion-text-muted">
            <span>替换为（可留空）</span>
            <input
              className={fieldClass}
              value={state.replaceText}
              disabled={busy}
              onChange={(e) => onReplaceChange(e.target.value)}
            />
          </label>
          <p className="text-xs text-notion-text-muted">{position}</p>

          <div className="flex min-h-0 flex-1 flex-col">
            {!state.searchCommitted ? (
              <p className={`rounded-md border border-notion-divider bg-notion-bg px-3 py-4 text-center ${PANEL_TYPOGRAPHY.dialogBody}`}>
                输入查找内容后点击「查找」，将列出匹配的语段全文。
              </p>
            ) : state.matchCount === 0 ? (
              <p className={`rounded-md border border-notion-divider bg-notion-bg px-3 py-4 text-center ${PANEL_TYPOGRAPHY.dialogBody}`}>
                未找到匹配「{state.findText}」的语段。
              </p>
            ) : state.matchCount === 1 && activeItem ? (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-notion-divider bg-notion-bg px-3 py-2">
                <FindResultMetaLine
                  segmentNumber={activeItem.segmentNumber}
                  timeLabel={activeItem.timeLabel}
                />
                <div className="mt-1">
                  <FindReplaceMatchText
                    text={activeItem.fullText}
                    charStart={activeItem.charStart}
                    charEnd={activeItem.charEnd}
                  />
                </div>
              </div>
            ) : (
              <FindResultList
                items={state.resultItems}
                activeMatchIndex={state.activeMatchIndex}
                onSelectMatch={onSelectMatch}
              />
            )}
          </div>

          <p className="text-[11px] text-notion-text-light">
            输入后自动查找 · Enter 下一处 · Shift+Enter 上一处 · ⌘Enter 替换并下一处
          </p>
          <div className="flex flex-wrap justify-start gap-2 border-t border-notion-divider pt-3">
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={!canAct} onClick={onPrev}>
              上一处
            </button>
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={!canAct} onClick={onNext}>
              下一处
            </button>
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={!canAct} onClick={onReplaceCurrent}>
              替换当前
            </button>
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={!canAct} onClick={onReplaceAndNext}>
              替换并下一处
            </button>
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={!canAct} onClick={onRequestReplaceAll}>
              全部替换…
            </button>
          </div>
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { SegmentDto } from "../../tauri/projectApi";
import {
  normalizeSegmentDraftText,
  segmentDraftKey,
  segmentDraftStore,
  useSegmentDraft,
} from "../../hooks/useSegmentDraftStore";
import { FindReplaceMatchText } from "../FindReplaceMatchText";
import { isCorrectionRulesPanelOpen } from "../../pages/correctionRulesPanelTypes";
import { isFindReplacePanelOpen } from "../../pages/findReplaceTypes";
import { CorrectableMatchText } from "./CorrectableMatchText";
import {
  resolveSegmentTextContextMenuAction,
  type SegmentTextContextMenuSelectionSnapshot,
} from "../../utils/segmentTextContextMenuSelection";
import {
  blurActiveTranscriptTextarea,
  syncTranscriptTextareaSelection,
} from "../../utils/transcriptSelection";
import type { CorrectableSpan } from "../../services/editor/findCorrectableSpans";

/** 正文区 DOM 标记：行级右键（删/并）应跳过此区域，统一走文本外观菜单。 */
export const SEGMENT_TEXT_BODY_ATTR = "data-seg-text-body";

interface SegmentRowTextFieldProps {
  segment: SegmentDto;
  index: number;
  selected: boolean;
  busy: boolean;
  segmentRowHeightPx: number;
  textStyle: React.CSSProperties;
  focusOnSelectRef: React.MutableRefObject<boolean>;
  editorRef?: React.RefObject<{ focusEditor: () => void } | null>;
  onSegmentRowHeightPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  selectSegmentAt: (idx: number) => void;
  updateSegmentText: (idx: number, text: string) => void;
  onTextareaKeyDown: (idx: number, e: KeyboardEvent<HTMLTextAreaElement>) => void;
  findReplaceHighlight?: { charStart: number; charEnd: number } | null;
  correctionRulesHighlight?: { charStart: number; charEnd: number } | null;
  spansForText: (text: string) => CorrectableSpan[];
  onCorrectableSpanClick: (span: CorrectableSpan, event: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenTextContextMenu?: (e: MouseEvent<HTMLElement>, selectionText: string) => void;
}

function initialTextareaValue(draftKey: string, committedText: string): string {
  return segmentDraftStore.getDraft(draftKey) ?? committedText;
}

export const SegmentRowTextField = memo(function SegmentRowTextField({
  segment: s,
  index: i,
  selected,
  busy,
  segmentRowHeightPx,
  textStyle,
  focusOnSelectRef,
  editorRef,
  onSegmentRowHeightPointerDown,
  updateSegmentText,
  onTextareaKeyDown,
  findReplaceHighlight,
  correctionRulesHighlight,
  spansForText,
  onCorrectableSpanClick,
  onOpenTextContextMenu,
}: SegmentRowTextFieldProps) {
  const draftKey = segmentDraftKey(s, i);
  const committedText = normalizeSegmentDraftText(s.text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preContextMenuSelectionRef = useRef<SegmentTextContextMenuSelectionSnapshot | null>(null);
  const isFocusedRef = useRef(false);
  const lastSyncedFindHighlightRef = useRef<string | null>(null);
  const [textareaEpoch, setTextareaEpoch] = useState(0);
  const prevCommittedRef = useRef(committedText);

  const defaultText = initialTextareaValue(draftKey, committedText);
  const [liveText] = useSegmentDraft(draftKey, committedText);
  const spanSourceText = selected ? liveText : committedText;
  const correctableSpans = useMemo(
    () => spansForText(spanSourceText),
    [spanSourceText, spansForText],
  );

  useImperativeHandle(
    editorRef,
    () => ({
      focusEditor: () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
      },
    }),
    [],
  );

  useEffect(() => {
    if (prevCommittedRef.current === committedText) {
      if (!isFocusedRef.current) {
        const stored = segmentDraftStore.getDraft(draftKey);
        if (stored !== undefined && stored === committedText) {
          segmentDraftStore.clearDraft(draftKey);
        }
      }
      return;
    }
    prevCommittedRef.current = committedText;

    // 自动保存 flush 写回 committed 时用户可能仍在输入；勿 remount textarea（会丢光标）。
    if (isFocusedRef.current) {
      const el = textareaRef.current;
      const liveDom = normalizeSegmentDraftText(el?.value ?? "");
      if (liveDom === committedText) {
        segmentDraftStore.clearDraft(draftKey);
      }
      return;
    }

    segmentDraftStore.clearDraft(draftKey);
    const el = textareaRef.current;
    if (el) el.value = committedText;
    setTextareaEpoch((n) => n + 1);
  }, [committedText, draftKey]);

  const syncDomToDraftStore = useCallback(
    (el: HTMLTextAreaElement) => {
      segmentDraftStore.setDraft(draftKey, el.value);
    },
    [draftKey],
  );

  const handleTextareaInput = useCallback(
    (el: HTMLTextAreaElement) => {
      if (segmentDraftStore.isComposing(draftKey)) return;
      syncDomToDraftStore(el);
    },
    [draftKey, syncDomToDraftStore],
  );

  const onCompositionStart = useCallback(() => {
    segmentDraftStore.beginComposition(draftKey);
  }, [draftKey]);

  const onCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      segmentDraftStore.endComposition(draftKey);
      syncDomToDraftStore(e.currentTarget);
    },
    [draftKey, syncDomToDraftStore],
  );

  const onBlurText = useCallback(() => {
    isFocusedRef.current = false;
    if (busy) return;
    segmentDraftStore.endComposition(draftKey);
    const el = textareaRef.current;
    const liveText = normalizeSegmentDraftText(el?.value ?? committedText);
    if (liveText !== committedText) updateSegmentText(i, liveText);
    if (liveText !== committedText) {
      segmentDraftStore.setDraft(draftKey, liveText);
    } else {
      segmentDraftStore.clearDraft(draftKey);
    }
  }, [busy, committedText, draftKey, i, updateSegmentText]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      onTextareaKeyDown(i, e);
    },
    [i, onTextareaKeyDown],
  );

  const onSelectionChange = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    syncTranscriptTextareaSelection(e.currentTarget);
  }, []);

  const openTextContextMenu = useCallback(
    (e: MouseEvent<HTMLElement>, selectionText: string) => {
      if (busy || !onOpenTextContextMenu) return;
      e.preventDefault();
      e.stopPropagation();
      blurActiveTranscriptTextarea();
      onOpenTextContextMenu(e, selectionText);
    },
    [busy, onOpenTextContextMenu],
  );

  const onTextPointerDownCapture = useCallback((e: PointerEvent<HTMLTextAreaElement>) => {
    if (e.button !== 2) return;
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    preContextMenuSelectionRef.current = {
      start,
      end,
      collapsed: start === end,
    };
  }, []);

  const onTextContextMenu = useCallback(
    (e: MouseEvent<HTMLTextAreaElement>) => {
      if (busy) return;
      const el = e.currentTarget;
      const snapshot = preContextMenuSelectionRef.current;
      preContextMenuSelectionRef.current = null;

      const action = resolveSegmentTextContextMenuAction({
        snapshot,
        value: el.value,
      });

      openTextContextMenu(e, action.selectionText);
    },
    [busy, openTextContextMenu],
  );

  const onStaticTextContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (busy) return;
      openTextContextMenu(e, "");
    },
    [busy, openTextContextMenu],
  );

  const onRowHeightHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onSegmentRowHeightPointerDown) return;
      e.stopPropagation();
      onSegmentRowHeightPointerDown(e);
    },
    [onSegmentRowHeightPointerDown],
  );

  useEffect(() => {
    if (!selected || busy) return;
    const el = textareaRef.current;
    const panelHighlight = findReplaceHighlight ?? correctionRulesHighlight;
    const panelPreviewOpen = isFindReplacePanelOpen() || isCorrectionRulesPanelOpen();
    if (panelHighlight) {
      if (panelPreviewOpen) return;
      const key = `${panelHighlight.charStart}:${panelHighlight.charEnd}`;
      if (lastSyncedFindHighlightRef.current === key) return;
      lastSyncedFindHighlightRef.current = key;
      el?.focus();
      el?.setSelectionRange(panelHighlight.charStart, panelHighlight.charEnd);
      return;
    }
    lastSyncedFindHighlightRef.current = null;
    if (!el || !focusOnSelectRef.current) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
    focusOnSelectRef.current = false;
  }, [busy, correctionRulesHighlight, findReplaceHighlight, focusOnSelectRef, selected]);

  useEffect(() => {
    if (selected) return;
    focusOnSelectRef.current = false;
  }, [focusOnSelectRef, selected]);

  const textAreaMinHeight = Math.max(36, Math.round(segmentRowHeightPx - (selected ? 24 : 30)));
  const panelHighlight = findReplaceHighlight ?? correctionRulesHighlight;
  const panelPreviewOpen = isFindReplacePanelOpen() || isCorrectionRulesPanelOpen();
  const hasPanelHighlight = panelHighlight != null;
  const showPanelHighlightMirror = selected && panelPreviewOpen && hasPanelHighlight && !busy;
  const showCorrectableMirror =
    selected &&
    !panelHighlight &&
    correctableSpans.length > 0 &&
    !busy;

  return (
    <div className="min-w-0 flex-1" {...{ [SEGMENT_TEXT_BODY_ATTR]: "" }}>
      <div className="rounded-lg bg-transparent transition-[background-color] duration-150">
        {selected ? (
          <>
            <div className="relative">
              <textarea
                key={`${draftKey}@${textareaEpoch}`}
                ref={textareaRef}
                className={[
                  "seg-text relative z-[1] min-h-[3.1rem] w-full resize-none border-0 bg-transparent px-4 py-2.5 font-[inherit] text-notion-text outline-none transition-colors duration-150 placeholder:text-notion-text-light",
                  showCorrectableMirror || showPanelHighlightMirror ? "text-transparent" : "",
                  "focus:ring-0 focus:ring-offset-0",
                  "disabled:cursor-not-allowed disabled:text-notion-text-light disabled:opacity-100",
                ].join(" ")}
                rows={1}
                style={{ ...textStyle, minHeight: textAreaMinHeight }}
                defaultValue={defaultText}
                disabled={busy}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDownCapture={onTextPointerDownCapture}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={onTextContextMenu}
                onFocus={() => {
                  if (busy) return;
                  isFocusedRef.current = true;
                }}
                onInput={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  handleTextareaInput(e.currentTarget);
                }}
                onCompositionStart={onCompositionStart}
                onCompositionEnd={onCompositionEnd}
                onBlur={onBlurText}
                onKeyDown={onKeyDown}
                onSelect={onSelectionChange}
                onMouseUp={onSelectionChange}
                onKeyUp={onSelectionChange}
                spellCheck={false}
                autoComplete="off"
                aria-label="语段正文"
                placeholder="输入语段文本..."
              />
              {showPanelHighlightMirror && panelHighlight ? (
                <div
                  className="pointer-events-none absolute inset-0 z-[2] overflow-hidden px-4 py-2.5 font-[inherit] text-notion-text"
                  style={textStyle}
                  aria-hidden
                >
                  <FindReplaceMatchText
                    text={liveText}
                    charStart={panelHighlight.charStart}
                    charEnd={panelHighlight.charEnd}
                    textStyle={textStyle}
                  />
                </div>
              ) : null}
              {showCorrectableMirror ? (
                <div
                  className="pointer-events-none absolute inset-0 z-[2] overflow-hidden px-4 py-2.5 text-notion-text"
                  aria-hidden
                >
                  <CorrectableMatchText
                    text={liveText}
                    spans={correctableSpans}
                    textStyle={textStyle}
                    onSpanClick={onCorrectableSpanClick}
                  />
                </div>
              ) : null}
            </div>

            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="拖拽调整语段高度"
              className={[
                "group/row-height relative h-2 rounded-b-md opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100",
                busy || !onSegmentRowHeightPointerDown
                  ? "pointer-events-none cursor-not-allowed"
                  : "pointer-events-none cursor-row-resize group-hover:pointer-events-auto focus-within:pointer-events-auto",
              ].join(" ")}
              onPointerDown={onRowHeightHandlePointerDown}
            />
          </>
        ) : (
          <div
            className={[
              "min-h-[3.1rem] px-4 py-2.5 transition-colors duration-150",
              hasPanelHighlight
                ? "text-notion-text"
                : "text-notion-text-muted group-hover:text-notion-text-muted",
            ].join(" ")}
            style={textStyle}
            aria-label="语段正文"
            onContextMenu={onStaticTextContextMenu}
          >
            {committedText.trim().length > 0 ? (
              hasPanelHighlight ? (
                <div className="max-h-[4.5rem] overflow-hidden">
                  <FindReplaceMatchText
                    text={committedText}
                    charStart={panelHighlight.charStart}
                    charEnd={panelHighlight.charEnd}
                    textStyle={textStyle}
                  />
                </div>
              ) : correctableSpans.length > 0 ? (
                <div className="max-h-[4.5rem] overflow-hidden">
                  <CorrectableMatchText
                    text={committedText}
                    spans={correctableSpans}
                    textStyle={textStyle}
                    className="overflow-hidden text-ellipsis whitespace-nowrap"
                    onSpanClick={onCorrectableSpanClick}
                  />
                </div>
              ) : (
                <p className="overflow-hidden text-ellipsis whitespace-nowrap">{committedText}</p>
              )
            ) : (
              <p className="overflow-hidden text-ellipsis whitespace-nowrap text-notion-text-light">
                输入语段文本...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

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
import { isFindReplacePanelOpen } from "../../pages/findReplaceTypes";
import { CorrectableMatchText } from "./CorrectableMatchText";
import { resolveSegmentTextContextMenuAction } from "../../utils/segmentTextContextMenuSelection";
import { syncTranscriptTextareaSelection } from "../../utils/transcriptSelection";
import type { CorrectableSpan } from "../../services/editor/findCorrectableSpans";

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
  spansForText: (text: string) => CorrectableSpan[];
  onCorrectableSpanClick: (span: CorrectableSpan, event: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenTextContextMenu?: (e: MouseEvent<HTMLTextAreaElement>, selectionText: string) => void;
  /** 无选区时右键：打开语段行菜单（删/并），避免正文区只有「纳入更正记忆」 */
  onRequestRowContextMenu?: (e: MouseEvent<HTMLTextAreaElement>) => void;
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
  spansForText,
  onCorrectableSpanClick,
  onOpenTextContextMenu,
  onRequestRowContextMenu,
}: SegmentRowTextFieldProps) {
  const draftKey = segmentDraftKey(s, i);
  const committedText = normalizeSegmentDraftText(s.text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preContextMenuSelectionRef = useRef<{ collapsed: boolean } | null>(null);
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
    segmentDraftStore.clearDraft(draftKey);
    const el = textareaRef.current;
    if (el && !isFocusedRef.current) el.value = committedText;
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

  const onTextPointerDownCapture = useCallback((e: PointerEvent<HTMLTextAreaElement>) => {
    if (e.button !== 2) return;
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    preContextMenuSelectionRef.current = {
      collapsed: start == null || end == null || start === end,
    };
  }, []);

  const onTextContextMenu = useCallback(
    (e: MouseEvent<HTMLTextAreaElement>) => {
      if (busy) return;
      const el = e.currentTarget;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const wasCollapsed =
        preContextMenuSelectionRef.current?.collapsed ?? start === end;
      preContextMenuSelectionRef.current = null;

      const action = resolveSegmentTextContextMenuAction({
        wasCollapsedBeforeContextMenu: wasCollapsed,
        selectionStart: start,
        selectionEnd: end,
        value: el.value,
      });

      if (action.kind === "row") {
        if (onRequestRowContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onRequestRowContextMenu(e);
        }
        return;
      }
      if (!onOpenTextContextMenu) return;
      e.preventDefault();
      e.stopPropagation();
      onOpenTextContextMenu(e, action.selectionText);
    },
    [busy, onOpenTextContextMenu, onRequestRowContextMenu],
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
    if (findReplaceHighlight) {
      const key = `${findReplaceHighlight.charStart}:${findReplaceHighlight.charEnd}`;
      if (lastSyncedFindHighlightRef.current === key) return;
      lastSyncedFindHighlightRef.current = key;
      if (!isFindReplacePanelOpen()) el?.focus();
      el?.setSelectionRange(findReplaceHighlight.charStart, findReplaceHighlight.charEnd);
      return;
    }
    lastSyncedFindHighlightRef.current = null;
    if (!el || !focusOnSelectRef.current) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
    focusOnSelectRef.current = false;
  }, [busy, findReplaceHighlight, focusOnSelectRef, selected]);

  useEffect(() => {
    if (selected) return;
    focusOnSelectRef.current = false;
  }, [focusOnSelectRef, selected]);

  const textAreaMinHeight = Math.max(36, Math.round(segmentRowHeightPx - (selected ? 24 : 30)));
  const showCorrectableMirror =
    selected &&
    !findReplaceHighlight &&
    correctableSpans.length > 0 &&
    !busy;

  return (
    <div className="min-w-0 flex-1">
      <div className="rounded-lg bg-transparent transition-[background-color] duration-150">
        {selected ? (
          <>
            <div className="relative">
              <textarea
                key={`${draftKey}@${textareaEpoch}`}
                ref={textareaRef}
                className={[
                  "seg-text relative z-[1] min-h-[3.1rem] w-full resize-none border-0 bg-transparent px-4 py-2.5 font-[inherit] text-notion-text outline-none transition-colors duration-150 placeholder:text-notion-text-light",
                  showCorrectableMirror ? "text-transparent" : "",
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
            className="min-h-[3.1rem] px-4 py-2.5 text-notion-text-light transition-colors duration-150 group-hover:text-notion-text-muted"
            style={textStyle}
            aria-label="语段正文"
          >
            {committedText.trim().length > 0 ? (
              findReplaceHighlight ? (
                <div className="max-h-[4.5rem] overflow-hidden">
                  <FindReplaceMatchText
                    text={committedText}
                    charStart={findReplaceHighlight.charStart}
                    charEnd={findReplaceHighlight.charEnd}
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

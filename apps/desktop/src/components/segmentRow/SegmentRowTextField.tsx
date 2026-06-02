import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { SegmentDto } from "../../tauri/projectApi";
import {
  normalizeSegmentDraftText,
  segmentDraftKey,
  segmentDraftStore,
  useSegmentDraft,
} from "../../hooks/useSegmentDraftStore";
import type { TextInputDomSnapshot } from "../../services/learnEditDelta";
import { shouldDeferDomInputForIme } from "../../services/deferImeLearnInput";
import { FindReplaceMatchText } from "../FindReplaceMatchText";
import { CorrectableMatchText } from "./CorrectableMatchText";
import { syncTranscriptTextareaSelection } from "../../utils/transcriptSelection";
import type { CorrectableSpan } from "../../services/editor/findCorrectableSpans";
import { shouldRetainDraftForPendingLearn } from "../../services/segmentLearnVisibility";

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
}: SegmentRowTextFieldProps) {
  const draftKey = segmentDraftKey(s, i);
  const committedText = normalizeSegmentDraftText(s.text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isFocusedRef = useRef(false);
  const lastSyncedFindHighlightRef = useRef<string | null>(null);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [textareaEpoch, setTextareaEpoch] = useState(0);
  const prevCommittedRef = useRef(committedText);
  const preEditRef = useRef<TextInputDomSnapshot | null>(null);
  const compositionStartSnapRef = useRef<TextInputDomSnapshot | null>(null);

  const captureTextareaSnapshot = useCallback((el: HTMLTextAreaElement): TextInputDomSnapshot => {
    return {
      value: el.value,
      start: el.selectionStart,
      end: el.selectionEnd,
    };
  }, []);

  const defaultText = initialTextareaValue(draftKey, committedText);
  const [liveText] = useSegmentDraft(draftKey, committedText);
  const correctableSpans = useMemo(
    () => spansForText(committedText),
    [committedText, spansForText],
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
        if (
          stored !== undefined &&
          stored === committedText &&
          !shouldRetainDraftForPendingLearn(draftKey, committedText, stored)
        ) {
          segmentDraftStore.clearDraft(draftKey);
        }
      }
      return;
    }
    prevCommittedRef.current = committedText;
    const stored = segmentDraftStore.getDraft(draftKey);
    if (stored !== undefined && shouldRetainDraftForPendingLearn(draftKey, committedText, stored)) {
      return;
    }
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
      const snap = preEditRef.current;
      if (snap && snap.value !== el.value && !shouldDeferDomInputForIme(snap, el.value)) {
        segmentDraftStore.applyLearnEditFromDomInput(draftKey, committedText, snap, el.value);
      }
      preEditRef.current = captureTextareaSnapshot(el);
      syncDomToDraftStore(el);
    },
    [captureTextareaSnapshot, committedText, draftKey, syncDomToDraftStore],
  );

  const applyCompositionLearnEdit = useCallback(
    (el: HTMLTextAreaElement) => {
      const startSnap = compositionStartSnapRef.current;
      compositionStartSnapRef.current = null;
      if (startSnap && startSnap.value !== el.value) {
        segmentDraftStore.applyLearnEditFromDomInput(draftKey, committedText, startSnap, el.value);
      }
      preEditRef.current = captureTextareaSnapshot(el);
      syncDomToDraftStore(el);
    },
    [captureTextareaSnapshot, committedText, draftKey, syncDomToDraftStore],
  );

  const onBeforeInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      preEditRef.current = captureTextareaSnapshot(e.currentTarget);
    },
    [captureTextareaSnapshot],
  );

  const onKeyDownCapture = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Dead" || e.ctrlKey || e.metaKey || e.altKey) return;
      preEditRef.current = captureTextareaSnapshot(e.currentTarget);
    },
    [captureTextareaSnapshot],
  );

  const onCompositionStart = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      const snap = captureTextareaSnapshot(el);
      compositionStartSnapRef.current = snap;
      preEditRef.current = snap;
      segmentDraftStore.beginComposition(
        draftKey,
        committedText,
        el.value,
        el.selectionStart,
        el.selectionEnd,
      );
    },
    [captureTextareaSnapshot, committedText, draftKey],
  );

  const onCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      segmentDraftStore.endComposition(draftKey);
      applyCompositionLearnEdit(e.currentTarget);
    },
    [applyCompositionLearnEdit, draftKey],
  );

  const onBlurText = useCallback(() => {
    isFocusedRef.current = false;
    setTextareaFocused(false);
    segmentDraftStore.endComposition(draftKey);
    segmentDraftStore.finalizeActiveLearnEditOp(draftKey);
    const el = textareaRef.current;
    const liveText = normalizeSegmentDraftText(el?.value ?? committedText);
    if (liveText !== committedText) updateSegmentText(i, liveText);
    if (shouldRetainDraftForPendingLearn(draftKey, committedText, liveText)) {
      segmentDraftStore.setDraft(draftKey, liveText);
    } else {
      segmentDraftStore.clearDraft(draftKey);
    }
    if (el) preEditRef.current = captureTextareaSnapshot(el);
  }, [captureTextareaSnapshot, committedText, draftKey, i, updateSegmentText]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      onTextareaKeyDown(i, e);
    },
    [i, onTextareaKeyDown],
  );

  const onSelectionChange = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      syncTranscriptTextareaSelection(el);
      if (document.activeElement === el) {
        preEditRef.current = captureTextareaSnapshot(el);
      }
    },
    [captureTextareaSnapshot],
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
    const anchor =
      segmentDraftStore.getLearnFocusBaseline(draftKey) ??
      normalizeSegmentDraftText(committedText);
    segmentDraftStore.beginSegmentLearnSession(draftKey, anchor);
    const el = textareaRef.current;
    if (el) preEditRef.current = captureTextareaSnapshot(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- committedText omitted: autosave must not reset ops
  }, [busy, draftKey, selected, captureTextareaSnapshot]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !selected) return;
    const snapBeforeInput = () => {
      preEditRef.current = captureTextareaSnapshot(el);
    };
    el.addEventListener("beforeinput", snapBeforeInput);
    return () => el.removeEventListener("beforeinput", snapBeforeInput);
  }, [selected, draftKey, textareaEpoch, captureTextareaSnapshot]);

  useEffect(() => {
    if (!selected || busy) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (findReplaceHighlight) {
      const key = `${findReplaceHighlight.charStart}:${findReplaceHighlight.charEnd}`;
      if (lastSyncedFindHighlightRef.current === key) return;
      lastSyncedFindHighlightRef.current = key;
      textarea.focus();
      textarea.setSelectionRange(findReplaceHighlight.charStart, findReplaceHighlight.charEnd);
      return;
    }
    lastSyncedFindHighlightRef.current = null;
    if (!focusOnSelectRef.current) return;
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
    focusOnSelectRef.current = false;
  }, [busy, findReplaceHighlight, focusOnSelectRef, selected]);

  useEffect(() => {
    if (selected) return;
    focusOnSelectRef.current = false;
  }, [focusOnSelectRef, selected]);

  const textAreaMinHeight = Math.max(36, Math.round(segmentRowHeightPx - (selected ? 24 : 30)));
  const showCorrectableOverlay =
    selected &&
    !textareaFocused &&
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
                  "focus:ring-0 focus:ring-offset-0",
                  "disabled:cursor-not-allowed disabled:text-notion-text-light disabled:opacity-100",
                ].join(" ")}
                rows={1}
                style={{ ...textStyle, minHeight: textAreaMinHeight }}
                defaultValue={defaultText}
                disabled={busy}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={() => {
                  if (busy) return;
                  isFocusedRef.current = true;
                  setTextareaFocused(true);
                  const el = textareaRef.current;
                  if (el) preEditRef.current = captureTextareaSnapshot(el);
                  const pendingBase = segmentDraftStore.getLearnFocusBaseline(draftKey);
                  if (pendingBase !== undefined && pendingBase !== committedText) {
                    return;
                  }
                  segmentDraftStore.setLearnFocusBaseline(draftKey, committedText);
                }}
                onBeforeInput={onBeforeInput}
                onInput={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  handleTextareaInput(e.currentTarget);
                }}
                onCompositionStart={onCompositionStart}
                onCompositionEnd={onCompositionEnd}
                onBlur={onBlurText}
                onKeyDownCapture={onKeyDownCapture}
                onKeyDown={onKeyDown}
                onSelect={onSelectionChange}
                onMouseUp={onSelectionChange}
                onKeyUp={onSelectionChange}
                spellCheck={false}
                autoComplete="off"
                aria-label="语段正文"
                placeholder="输入语段文本..."
              />
              {showCorrectableOverlay ? (
                <div
                  className="pointer-events-none absolute inset-0 z-[2] overflow-hidden px-4 py-2.5"
                  aria-hidden
                >
                  <CorrectableMatchText
                    text={liveText}
                    spans={correctableSpans}
                    className="whitespace-pre-wrap break-words text-sm leading-snug text-notion-text"
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
                    className="overflow-hidden text-ellipsis whitespace-nowrap text-inherit"
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

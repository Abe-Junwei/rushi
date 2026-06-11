import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  normalizeSegmentDraftText,
  segmentDraftKey,
  segmentDraftStore,
  useSegmentDraft,
} from "./useSegmentDraftStore";
import { syncTranscriptTextareaSelection } from "../utils/transcriptSelection";
import {
  useSegmentRowTextFieldKeyHandler,
  useSegmentRowTextFieldPointerHandlers,
} from "./useSegmentRowTextFieldPointerHandlers";
import type { SegmentRowTextFieldEditingArgs } from "./useSegmentRowTextFieldEditing.types";

function initialTextareaValue(draftKey: string, committedText: string): string {
  return segmentDraftStore.getDraft(draftKey) ?? committedText;
}

export function useSegmentRowTextFieldEditing({
  segment: s,
  index: i,
  selected,
  busy,
  editorRef,
  onSegmentRowHeightPointerDown,
  updateSegmentText,
  onTextareaKeyDown,
  spansForText,
  onOpenTextContextMenu,
}: SegmentRowTextFieldEditingArgs) {
  const draftKey = segmentDraftKey(s, i);
  const committedText = normalizeSegmentDraftText(s.text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isFocusedRef = useRef(false);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
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
    if (selected) return;
    const el = textareaRef.current;
    if (el && document.activeElement === el) {
      el.blur();
    }
  }, [selected]);

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
    setIsTextareaFocused(false);
    if (busy) return;
    segmentDraftStore.endComposition(draftKey);
    segmentDraftStore.flushPendingEmit();
    const el = textareaRef.current;
    const liveText = normalizeSegmentDraftText(el?.value ?? committedText);
    if (liveText !== committedText) updateSegmentText(i, liveText);
    if (liveText !== committedText) {
      segmentDraftStore.setDraft(draftKey, liveText);
    } else {
      segmentDraftStore.clearDraft(draftKey);
    }
  }, [busy, committedText, draftKey, i, updateSegmentText]);

  const onKeyDown = useSegmentRowTextFieldKeyHandler(i, onTextareaKeyDown);

  const onSelectionChange = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    syncTranscriptTextareaSelection(e.currentTarget);
  }, []);

  const pointerHandlers = useSegmentRowTextFieldPointerHandlers({
    busy,
    onSegmentRowHeightPointerDown,
    onOpenTextContextMenu,
  });

  const onFocusText = useCallback(() => {
    if (busy) return;
    isFocusedRef.current = true;
    setIsTextareaFocused(true);
  }, [busy]);

  return {
    draftKey,
    committedText,
    liveText,
    correctableSpans,
    isTextareaFocused,
    textareaRef,
    textareaEpoch,
    defaultText,
    handleTextareaInput,
    onCompositionStart,
    onCompositionEnd,
    onBlurText,
    onKeyDown,
    onSelectionChange,
    onFocusText,
    ...pointerHandlers,
  };
}

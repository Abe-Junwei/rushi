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
} from "./useSegmentDraftStore";
import { syncTranscriptTextareaSelection } from "../utils/transcriptSelection";
import {
  useSegmentRowTextFieldKeyHandler,
  useSegmentRowTextFieldPointerHandlers,
} from "./useSegmentRowTextFieldPointerHandlers";
import type { SegmentRowTextFieldEditingArgs } from "./useSegmentRowTextFieldEditing.types";

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
  const committedTextRef = useRef(committedText);
  const busyRef = useRef(busy);
  if (!isFocusedRef.current) {
    committedTextRef.current = committedText;
  }
  busyRef.current = busy;

  const syncInputToSegments = useCallback(
    (el: HTMLTextAreaElement) => {
      if (busyRef.current) return;
      segmentDraftStore.endComposition(draftKey);
      const liveText = normalizeSegmentDraftText(el.value);
      const committed = committedTextRef.current;
      if (liveText === committed) {
        segmentDraftStore.clearDraft(draftKey);
        return;
      }
      updateSegmentText(i, liveText);
      committedTextRef.current = liveText;
      segmentDraftStore.clearDraft(draftKey);
    },
    [draftKey, i, updateSegmentText],
  );

  const flushTextareaEdits = useCallback(
    (el: HTMLTextAreaElement | null) => {
      if (busyRef.current) return;
      segmentDraftStore.endComposition(draftKey);
      segmentDraftStore.flushPendingEmit();
      if (!el) return;
      const liveText = normalizeSegmentDraftText(el.value);
      const committed = committedTextRef.current;
      if (liveText !== committed) {
        updateSegmentText(i, liveText);
        committedTextRef.current = liveText;
      }
      segmentDraftStore.clearDraft(draftKey);
    },
    [draftKey, i, updateSegmentText],
  );

  const defaultText = committedText;
  const liveText = committedText;
  const spanSourceText = committedText;
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
    return () => {
      const el = textareaRef.current;
      if (el && (segmentDraftStore.isComposing(draftKey) || normalizeSegmentDraftText(el.value) !== committedTextRef.current)) {
        flushTextareaEdits(el);
      }
      segmentDraftStore.endComposition(draftKey);
      segmentDraftStore.clearDraft(draftKey);
      segmentDraftStore.flushPendingEmit();
    };
  }, [draftKey, flushTextareaEdits]);

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
        segmentDraftStore.clearDraft(draftKey);
      }
      return;
    }
    prevCommittedRef.current = committedText;

    if (isFocusedRef.current) {
      const el = textareaRef.current;
      const liveDom = normalizeSegmentDraftText(el?.value ?? "");
      if (liveDom === committedText) {
        committedTextRef.current = committedText;
        segmentDraftStore.clearDraft(draftKey);
        return;
      }
      if (segmentDraftStore.isComposing(draftKey)) return;
      if (el) el.value = committedText;
      committedTextRef.current = committedText;
      segmentDraftStore.clearDraft(draftKey);
      return;
    }

    segmentDraftStore.clearDraft(draftKey);
    const el = textareaRef.current;
    if (el) el.value = committedText;
    setTextareaEpoch((n) => n + 1);
  }, [committedText, draftKey]);

  const handleTextareaInput = useCallback(
    (el: HTMLTextAreaElement) => {
      if (segmentDraftStore.isComposing(draftKey)) return;
      syncInputToSegments(el);
    },
    [draftKey, syncInputToSegments],
  );

  const onCompositionStart = useCallback(() => {
    segmentDraftStore.beginComposition(draftKey);
  }, [draftKey]);

  const onCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      segmentDraftStore.endComposition(draftKey);
      syncInputToSegments(e.currentTarget);
    },
    [draftKey, syncInputToSegments],
  );

  const onBlurText = useCallback(() => {
    isFocusedRef.current = false;
    setIsTextareaFocused(false);
    flushTextareaEdits(textareaRef.current);
  }, [flushTextareaEdits]);

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

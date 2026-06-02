import { memo, useCallback, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from "react";
import type { SegmentDto } from "../../tauri/projectApi";
import {
  normalizeSegmentDraftText,
  segmentDraftKey,
  segmentDraftStore,
  useSegmentDraft,
} from "../../hooks/useSegmentDraftStore";
import { FindReplaceMatchText } from "../FindReplaceMatchText";
import { syncTranscriptTextareaSelection } from "../../utils/transcriptSelection";

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
  selectSegmentAt,
  updateSegmentText,
  onTextareaKeyDown,
  findReplaceHighlight,
}: SegmentRowTextFieldProps) {
  const draftKey = segmentDraftKey(s, i);
  const [draft, setDraft] = useSegmentDraft(draftKey, s.text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastSyncedFindHighlightRef = useRef<string | null>(null);

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
    const stored = segmentDraftStore.getDraft(draftKey);
    if (stored === undefined) return;
    const current = normalizeSegmentDraftText(s.text ?? "");
    if (stored === current) segmentDraftStore.clearDraft(draftKey);
  }, [draftKey, s.text]);

  const onTextAreaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraft(e.target.value);
    },
    [setDraft],
  );

  const onBlurText = useCallback(() => {
    const current = normalizeSegmentDraftText(s.text ?? "");
    if (draft !== current) updateSegmentText(i, draft);
    segmentDraftStore.clearDraft(draftKey);
  }, [draft, draftKey, i, s.text, updateSegmentText]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      onTextareaKeyDown(i, e);
    },
    [i, onTextareaKeyDown],
  );

  const onSelectionChange = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    syncTranscriptTextareaSelection(e.currentTarget);
  }, []);

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

  const committedText = normalizeSegmentDraftText(s.text ?? "");
  const textAreaMinHeight = Math.max(36, Math.round(segmentRowHeightPx - (selected ? 24 : 30)));

  return (
    <div className="min-w-0 flex-1">
      <div
        className="rounded-lg transition-[background-color] duration-150 bg-transparent"
      >
        {selected ? (
          <>
            <textarea
              ref={textareaRef}
              className={[
                "seg-text min-h-[3.1rem] w-full resize-none border-0 bg-transparent px-4 py-2.5 text-notion-text outline-none transition-colors duration-150 placeholder:text-notion-text-light",
                "focus:ring-0 focus:ring-offset-0",
                "disabled:cursor-not-allowed disabled:text-notion-text-light disabled:opacity-100",
              ].join(" ")}
              rows={1}
              style={{ ...textStyle, minHeight: textAreaMinHeight }}
              value={draft}
              disabled={busy}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => {
                if (busy) return;
                selectSegmentAt(i);
              }}
              onChange={onTextAreaChange}
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
              ) : (
                <p className="overflow-hidden text-ellipsis whitespace-nowrap">{committedText}</p>
              )
            ) : (
              <p className="overflow-hidden text-ellipsis whitespace-nowrap text-notion-text-light">输入语段文本...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

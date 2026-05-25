import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { SegmentDto } from "../../tauri/projectApi";

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
}: SegmentRowTextFieldProps) {
  const [draft, setDraft] = useState(() => (s.text ?? "").replace(/\r\n|\r|\n/g, ""));
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    setDraft((s.text ?? "").replace(/\r\n|\r|\n/g, ""));
  }, [s.text]);

  const onTextAreaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value.replace(/\r\n|\r|\n/g, " "));
  }, []);

  const onBlurText = useCallback(() => {
    const current = (s.text ?? "").replace(/\r\n|\r|\n/g, "");
    if (draft !== current) updateSegmentText(i, draft);
  }, [draft, i, s.text, updateSegmentText]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      onTextareaKeyDown(i, e);
    },
    [i, onTextareaKeyDown],
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
    if (!selected || !focusOnSelectRef.current || busy) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
    focusOnSelectRef.current = false;
  }, [busy, focusOnSelectRef, selected]);

  useEffect(() => {
    if (selected) return;
    focusOnSelectRef.current = false;
  }, [focusOnSelectRef, selected]);

  const committedText = (s.text ?? "").replace(/\r\n|\r|\n/g, " ");
  const textAreaMinHeight = Math.max(36, Math.round(segmentRowHeightPx - (selected ? 24 : 30)));

  return (
    <div className="min-w-0 flex-1">
      <div
        className={[
          "rounded-lg transition-[background-color] duration-150",
          selected ? "bg-notion-bg" : "bg-transparent",
        ].join(" ")}
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
              onFocus={() => {
                if (!busy) selectSegmentAt(i);
              }}
              onChange={onTextAreaChange}
              onBlur={onBlurText}
              onKeyDown={onKeyDown}
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
              <p className="overflow-hidden text-ellipsis whitespace-nowrap">{committedText}</p>
            ) : (
              <p className="overflow-hidden text-ellipsis whitespace-nowrap text-notion-text-light">输入语段文本...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

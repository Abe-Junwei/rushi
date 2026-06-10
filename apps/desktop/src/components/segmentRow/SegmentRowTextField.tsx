import { memo, type KeyboardEvent, type MouseEvent } from "react";
import type { SegmentDto } from "../../tauri/projectApi";
import type { CorrectableSpan } from "../../services/editor/findCorrectableSpans";
import { FindReplaceMatchText } from "../FindReplaceMatchText";
import { CorrectableMatchText } from "./CorrectableMatchText";
import { useSegmentRowTextFieldController } from "../../hooks/useSegmentRowTextFieldController";

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
  onRowRangePointerDown?: (index: number, e: React.PointerEvent<HTMLElement>) => void;
  selectSegmentAt: (idx: number) => void;
  updateSegmentText: (idx: number, text: string) => void;
  onTextareaKeyDown: (idx: number, e: KeyboardEvent<HTMLTextAreaElement>) => void;
  findReplaceHighlight?: { charStart: number; charEnd: number } | null;
  correctionRulesHighlight?: { charStart: number; charEnd: number } | null;
  spansForText: (text: string) => CorrectableSpan[];
  onCorrectableSpanClick: (span: CorrectableSpan, event: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenTextContextMenu?: (e: MouseEvent<HTMLElement>, selectionText: string) => void;
}

export const SegmentRowTextField = memo(function SegmentRowTextField(props: SegmentRowTextFieldProps) {
  const {
    selected,
    busy,
    textStyle,
    selectSegmentAt: _selectSegmentAt,
    ...controllerArgs
  } = props;

  const {
    draftKey,
    committedText,
    liveText,
    correctableSpans,
    textareaRef,
    textareaEpoch,
    defaultText,
    textAreaMinHeight,
    panelHighlight,
    hasPanelHighlight,
    showPanelHighlightMirror,
    showCorrectableMirror,
    onTextPointerDownCapture,
    onTextContextMenu,
    onStaticTextContextMenu,
    onRowHeightHandlePointerDown,
    handleTextareaInput,
    onCompositionStart,
    onCompositionEnd,
    onBlurText,
    onKeyDown,
    onSelectionChange,
    onFocusText,
    canResizeRowHeight,
  } = useSegmentRowTextFieldController({ ...controllerArgs, selected, busy });

  const { onCorrectableSpanClick } = props;

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
                onPointerDownCapture={onTextPointerDownCapture}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={onTextContextMenu}
                onFocus={onFocusText}
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
                canResizeRowHeight
                  ? "pointer-events-none cursor-row-resize group-hover:pointer-events-auto focus-within:pointer-events-auto"
                  : "pointer-events-none cursor-not-allowed",
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
                    charStart={panelHighlight!.charStart}
                    charEnd={panelHighlight!.charEnd}
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

import { memo, useCallback, type KeyboardEvent, type MouseEvent } from "react";
import type { SegmentDto } from "../../tauri/projectApi";
import type { CorrectableSpan } from "../../services/editor/findCorrectableSpans";
import { FindReplaceMatchText } from "../FindReplaceMatchText";
import { CspLayout } from "../CspLayout";
import { CorrectableMatchText } from "./CorrectableMatchText";
import { SegmentTextMirrorShell } from "./SegmentTextMirrorShell";
import { useSegmentRowTextFieldController } from "../../hooks/useSegmentRowTextFieldController";
import { segmentTextAreaLayoutVars, type SegmentRowTextStyle } from "./useSegmentRowTextStyle";

/** 正文区 DOM 标记：行级右键（删/并）应跳过此区域，统一走文本外观菜单。 */
const SEGMENT_TEXT_BODY_ATTR = "data-seg-text-body";

interface SegmentRowTextFieldProps {
  segment: SegmentDto;
  index: number;
  selected: boolean;
  busy: boolean;
  segmentRowHeightPx: number;
  textStyle: SegmentRowTextStyle;
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
    selectSegmentAt,
    index,
    onRowRangePointerDown,
    ...controllerArgs
  } = props;

  const {
    draftKey,
    committedText,
    liveText,
    mirrorLiveText,
    mirrorCorrectableSpans,
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
    onRowHeightHandlePointerDown,
    handleTextareaInput,
    onCompositionStart,
    onCompositionEnd,
    onBlurText,
    onKeyDown,
    onSelectionChange,
    onFocusText,
    canResizeRowHeight,
  } = useSegmentRowTextFieldController({ ...controllerArgs, index, selected, busy, selectSegmentAt });
  const onResizeHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onRowHeightHandlePointerDown(e);
  };

  const onTextareaPointerDownCapture = useCallback(
    (e: React.PointerEvent<HTMLTextAreaElement>) => {
      if (busy) return;
      if (e.button === 2) {
        onTextPointerDownCapture(e);
        return;
      }
      if (e.button !== 0) return;
      onRowRangePointerDown?.(index, e);
    },
    [busy, index, onRowRangePointerDown, onTextPointerDownCapture],
  );

  const { onCorrectableSpanClick } = props;
  const panelMirrorText = selected ? liveText : committedText;
  const useTransparentText = showPanelHighlightMirror || showCorrectableMirror;

  return (
    <div className="segment-row-text-body" {...{ [SEGMENT_TEXT_BODY_ATTR]: "" }}>
      <div className="rounded-lg bg-transparent transition-[background-color] duration-150">
        <div className="relative">
          <CspLayout
            as="textarea"
            key={`${draftKey}@${textareaEpoch}`}
            ref={textareaRef}
            readOnly={!selected}
            className={[
              "seg-text relative z-[1] w-full resize-none border-0 bg-transparent px-4 py-2.5 font-[inherit] outline-none transition-colors duration-150 placeholder:text-notion-text-light",
              selected
                ? "text-notion-text"
                : hasPanelHighlight
                  ? "text-notion-text"
                  : "cursor-default overflow-hidden text-ellipsis whitespace-nowrap text-notion-text-muted group-hover:text-notion-text-muted",
              useTransparentText ? "text-transparent" : "",
              "focus:ring-0 focus:ring-offset-0",
              "read-only:cursor-default read-only:opacity-100",
              "disabled:cursor-not-allowed disabled:text-notion-text-light disabled:opacity-100",
            ].join(" ")}
            rows={1}
            layout={segmentTextAreaLayoutVars(textStyle, textAreaMinHeight, selected)}
            defaultValue={defaultText}
            disabled={busy}
            tabIndex={selected ? 0 : -1}
            onPointerDownCapture={onTextareaPointerDownCapture}
            onContextMenu={onTextContextMenu}
            onFocus={selected ? onFocusText : undefined}
            onInput={
              selected
                ? (e) => {
                    if (e.nativeEvent.isComposing) return;
                    handleTextareaInput(e.currentTarget);
                  }
                : undefined
            }
            onCompositionStart={selected ? onCompositionStart : undefined}
            onCompositionEnd={selected ? onCompositionEnd : undefined}
            onBlur={selected ? onBlurText : undefined}
            onKeyDown={selected ? onKeyDown : undefined}
            onSelect={selected ? onSelectionChange : undefined}
            onMouseUp={selected ? onSelectionChange : undefined}
            onKeyUp={selected ? onSelectionChange : undefined}
            spellCheck={false}
            autoComplete="off"
            aria-label="语段正文"
            aria-readonly={!selected}
            placeholder="输入语段文本..."
          />
          {showPanelHighlightMirror && panelHighlight ? (
            <SegmentTextMirrorShell
              selected={selected}
              textAreaMinHeight={textAreaMinHeight}
              textStyle={textStyle}
              pointerEventsNone
              ariaHidden
            >
              <FindReplaceMatchText
                text={panelMirrorText}
                charStart={panelHighlight.charStart}
                charEnd={panelHighlight.charEnd}
                textStyle={textStyle}
              />
            </SegmentTextMirrorShell>
          ) : null}
          {showCorrectableMirror ? (
            <SegmentTextMirrorShell
              selected={selected}
              textAreaMinHeight={textAreaMinHeight}
              textStyle={textStyle}
              ariaHidden={selected}
            >
              <CorrectableMatchText
                text={mirrorLiveText}
                spans={mirrorCorrectableSpans}
                textStyle={textStyle}
                emphasizeHitText={!selected}
                className={selected ? undefined : "overflow-hidden text-ellipsis whitespace-nowrap"}
                onSpanClick={
                  selected
                    ? onCorrectableSpanClick
                    : (span, event) => {
                        selectSegmentAt(index);
                        onCorrectableSpanClick(span, event);
                      }
                }
              />
            </SegmentTextMirrorShell>
          ) : null}
        </div>

        {selected ? (
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
            onPointerDown={onResizeHandlePointerDown}
          />
        ) : null}
      </div>
    </div>
  );
});

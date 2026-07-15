import { RangeSetBuilder, StateField, type Extension } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import type { MutableRefObject } from "react";
import { transcriptHoverSegmentField, setTranscriptHoverSegmentEffect } from "./hoverSegmentField";

export type TranscriptRowHeightDragFromDom = (target: HTMLElement, event: PointerEvent) => void;

class SegmentRowHeightResizeWidget extends WidgetType {
  constructor(
    private readonly onPointerDownRef: MutableRefObject<TranscriptRowHeightDragFromDom | undefined>,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return other instanceof SegmentRowHeightResizeWidget;
  }

  toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "cm-transcript-row-height-resize";
    el.setAttribute("role", "separator");
    el.setAttribute("aria-orientation", "horizontal");
    el.setAttribute("aria-label", "上下拖动调节语段高度（字号联动）");
    el.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onPointerDownRef.current?.(el, event);
    });
    return el;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

const resizeHostLineDeco = Decoration.line({
  attributes: { class: "cm-transcript-line-resize-host" },
});

function buildRowHeightResizeDecorations(
  state: EditorState,
  widget: SegmentRowHeightResizeWidget,
): DecorationSet {
  const hoverIdx = state.field(transcriptHoverSegmentField);
  if (hoverIdx == null || hoverIdx < 0 || hoverIdx >= state.doc.lines) {
    return Decoration.none;
  }
  const line = state.doc.line(hoverIdx + 1);
  const builder = new RangeSetBuilder<Decoration>();
  builder.add(line.from, line.from, resizeHostLineDeco);
  builder.add(
    line.to,
    line.to,
    Decoration.widget({
      widget,
      side: 1,
      block: false,
    }),
  );
  return builder.finish();
}

export function createTranscriptRowHeightResizeExtensions(
  onPointerDownRef: MutableRefObject<TranscriptRowHeightDragFromDom | undefined>,
): Extension[] {
  const widget = new SegmentRowHeightResizeWidget(onPointerDownRef);
  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildRowHeightResizeDecorations(state, widget);
    },
    update(value, tr) {
      const hoverChanged = tr.effects.some((e) => e.is(setTranscriptHoverSegmentEffect));
      const hoverFieldChanged =
        tr.startState.field(transcriptHoverSegmentField) !==
        tr.state.field(transcriptHoverSegmentField);
      if (hoverChanged || hoverFieldChanged || tr.docChanged) {
        return buildRowHeightResizeDecorations(tr.state, widget);
      }
      return value;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
  return [field];
}

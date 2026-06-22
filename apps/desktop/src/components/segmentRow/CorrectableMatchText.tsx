import type { ReactNode } from "react";
import type { CorrectableSpan } from "../../services/editor/findCorrectableSpans";
import { CspLayout } from "../CspLayout";
import {
  segmentTextTypographyLayout,
  type SegmentRowTextStyle,
} from "./useSegmentRowTextStyle";

const ROOT_CLASS = "m-0 whitespace-pre-wrap break-words text-inherit";
const HIT_CLASS = "seg-correctable-hit";
const HIT_EMPHASIZED_CLASS = "seg-correctable-hit--emphasized";

type Props = {
  text: string;
  spans: CorrectableSpan[];
  className?: string;
  /** 语段镜像：与 textarea 对齐的排版（含加粗/斜体/字号/字体） */
  textStyle?: SegmentRowTextStyle;
  /** 未选中预览：命中词加深，其余继承根节点 muted 色 */
  emphasizeHitText?: boolean;
  onSpanClick?: (span: CorrectableSpan, event: React.MouseEvent<HTMLButtonElement>) => void;
};

function MirrorRoot({
  textStyle,
  className,
  children,
}: {
  textStyle?: SegmentRowTextStyle;
  className: string;
  children: ReactNode;
}) {
  if (textStyle) {
    return (
      <CspLayout as="p" className={className} layout={segmentTextTypographyLayout(textStyle)}>
        {children}
      </CspLayout>
    );
  }
  return <p className={className}>{children}</p>;
}

export function CorrectableMatchText({
  text,
  spans,
  className,
  textStyle,
  emphasizeHitText = false,
  onSpanClick,
}: Props) {
  const hitClassName = emphasizeHitText ? `${HIT_CLASS} ${HIT_EMPHASIZED_CLASS}` : HIT_CLASS;
  const rootClass = className ? `${ROOT_CLASS} ${className}` : ROOT_CLASS;

  if (!text) {
    return (
      <MirrorRoot textStyle={textStyle} className={rootClass}>
        输入语段文本...
      </MirrorRoot>
    );
  }
  if (!spans.length) {
    return (
      <MirrorRoot textStyle={textStyle} className={rootClass}>
        {text}
      </MirrorRoot>
    );
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const span of spans) {
    const start = Math.max(0, Math.min(span.charStart, text.length));
    const end = Math.max(start, Math.min(span.charEnd, text.length));
    if (start > cursor) {
      nodes.push(<span key={`t-${cursor}`}>{text.slice(cursor, start)}</span>);
    }
    if (end > start) {
      const slice = text.slice(start, end);
      if (onSpanClick) {
        nodes.push(
          <button
            key={`m-${start}-${end}`}
            type="button"
            className={hitClassName}
            onClick={(e) => {
              e.stopPropagation();
              onSpanClick(span, e);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="查看改正建议"
          >
            {slice}
          </button>,
        );
      } else {
        nodes.push(
          <span key={`m-${start}-${end}`} className={hitClassName}>
            {slice}
          </span>,
        );
      }
    }
    cursor = end;
  }
  if (cursor < text.length) {
    nodes.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return (
    <MirrorRoot textStyle={textStyle} className={rootClass}>
      {nodes}
    </MirrorRoot>
  );
}

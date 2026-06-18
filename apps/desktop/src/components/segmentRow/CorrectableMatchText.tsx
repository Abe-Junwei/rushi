import type { CSSProperties, ReactNode } from "react";
import type { CorrectableSpan } from "../../services/editor/findCorrectableSpans";
import { CspLayout } from "../CspLayout";
import type { CspLayoutRules } from "../../utils/cspElementLayout";

const ROOT_CLASS = "m-0 whitespace-pre-wrap break-words leading-snug text-inherit";
const HIT_CLASS = "seg-correctable-hit";

type Props = {
  text: string;
  spans: CorrectableSpan[];
  className?: string;
  textStyle?: CSSProperties;
  onSpanClick?: (span: CorrectableSpan, event: React.MouseEvent<HTMLButtonElement>) => void;
};

export function CorrectableMatchText({ text, spans, className, textStyle, onSpanClick }: Props) {
  const rootClass = className ? `${ROOT_CLASS} ${className}` : ROOT_CLASS;

  if (!text) {
    return textStyle ? (
      <CspLayout as="p" className={rootClass} layout={textStyle as CspLayoutRules}>
        输入语段文本...
      </CspLayout>
    ) : (
      <p className={rootClass}>输入语段文本...</p>
    );
  }
  if (!spans.length) {
    return textStyle ? (
      <CspLayout as="p" className={rootClass} layout={textStyle as CspLayoutRules}>
        {text}
      </CspLayout>
    ) : (
      <p className={rootClass}>{text}</p>
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
            className={HIT_CLASS}
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
          <span key={`m-${start}-${end}`} className={HIT_CLASS}>
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

  return textStyle ? (
    <CspLayout as="p" className={rootClass} layout={textStyle as CspLayoutRules}>
      {nodes}
    </CspLayout>
  ) : (
    <p className={rootClass}>{nodes}</p>
  );
}

import type { CorrectableSpan } from "../../services/editor/findCorrectableSpans";

type Props = {
  text: string;
  spans: CorrectableSpan[];
  className?: string;
  onSpanClick?: (span: CorrectableSpan, event: React.MouseEvent<HTMLButtonElement>) => void;
};

export function CorrectableMatchText({ text, spans, className, onSpanClick }: Props) {
  if (!text) {
    return (
      <p className={className ?? "whitespace-pre-wrap break-words text-sm leading-snug text-notion-text-light"}>
        输入语段文本...
      </p>
    );
  }
  if (!spans.length) {
    return (
      <p className={className ?? "whitespace-pre-wrap break-words text-sm leading-snug text-notion-text"}>{text}</p>
    );
  }

  const nodes: React.ReactNode[] = [];
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
            className="pointer-events-auto cursor-pointer rounded-sm bg-zen-saffron/25 px-0.5 text-inherit underline decoration-zen-saffron/70 decoration-dotted underline-offset-2 hover:bg-zen-saffron/40"
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
          <mark
            key={`m-${start}-${end}`}
            className="rounded-sm bg-zen-saffron/25 px-0.5 text-inherit"
          >
            {slice}
          </mark>,
        );
      }
    }
    cursor = end;
  }
  if (cursor < text.length) {
    nodes.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return (
    <p className={className ?? "whitespace-pre-wrap break-words text-sm leading-snug text-notion-text"}>{nodes}</p>
  );
}

import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { CorrectionHighlightSpan } from "../services/editor/segmentCorrectionRulesApply";
import { splitGraphemes } from "../services/text/grapheme";

const HIGHLIGHT_BEFORE =
  "rounded-sm bg-red-500/15 px-0.5 text-notion-text line-through decoration-notion-text-light/70";
const HIGHLIGHT_AFTER = "rounded-sm bg-accent-action/25 px-0.5 text-notion-text";

type Props = {
  beforeText: string;
  afterText: string;
  beforeHighlights: CorrectionHighlightSpan[];
  afterHighlights: CorrectionHighlightSpan[];
  variant?: "full" | "compact" | "inline" | "wrap";
};

function buildHighlightedParts(text: string, spans: CorrectionHighlightSpan[]) {
  const glyphs = splitGraphemes(text);
  if (!glyphs.length) return [{ text: "", highlight: false }];

  const marked = new Set<number>();
  for (const span of spans) {
    const end = Math.min(span.endG, glyphs.length);
    for (let g = span.startG; g < end; g++) marked.add(g);
  }

  const parts: { text: string; highlight: boolean }[] = [];
  let buf = glyphs[0] ?? "";
  let cur = marked.has(0);
  for (let g = 1; g < glyphs.length; g++) {
    const h = marked.has(g);
    if (h === cur) {
      buf += glyphs[g];
      continue;
    }
    parts.push({ text: buf, highlight: cur });
    buf = glyphs[g] ?? "";
    cur = h;
  }
  parts.push({ text: buf, highlight: cur });
  return parts.filter((p) => p.text.length > 0);
}

function HighlightedLine({
  text,
  spans,
  highlightClass,
  bodyClass,
  as: Tag = "p",
}: {
  text: string;
  spans: CorrectionHighlightSpan[];
  highlightClass: string;
  bodyClass: string;
  as?: "p" | "span";
}) {
  const parts = buildHighlightedParts(text, spans);
  return (
    <Tag className={bodyClass}>
      {parts.map((part, idx) =>
        part.highlight ? (
          <mark key={`${idx}-${part.text}`} className={highlightClass}>
            {part.text}
          </mark>
        ) : (
          <span key={`${idx}-${part.text}`}>{part.text}</span>
        ),
      )}
    </Tag>
  );
}

export function CorrectionRulesChangeText({
  beforeText,
  afterText,
  beforeHighlights,
  afterHighlights,
  variant = "full",
}: Props) {
  if (variant === "wrap") {
    return (
      <div className="min-w-0 space-y-1">
        <HighlightedLine
          text={beforeText}
          spans={beforeHighlights}
          highlightClass={HIGHLIGHT_BEFORE}
          bodyClass="m-0 whitespace-pre-wrap break-words text-sm leading-snug text-notion-text-muted"
        />
        <p className="m-0 text-xs leading-none text-notion-text-light" aria-hidden>
          →
        </p>
        <HighlightedLine
          text={afterText}
          spans={afterHighlights}
          highlightClass={HIGHLIGHT_AFTER}
          bodyClass="m-0 whitespace-pre-wrap break-words text-sm leading-snug text-notion-text"
        />
      </div>
    );
  }

  if (variant === "compact" || variant === "inline") {
    const rowClass =
      variant === "inline"
        ? "m-0 inline truncate whitespace-nowrap text-sm leading-snug text-notion-text-muted"
        : `m-0 truncate ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`;
    const lineClass =
      variant === "inline" ? "inline text-sm leading-snug" : `inline ${PANEL_TYPOGRAPHY.meta}`;
    return (
      <span className={rowClass}>
        <HighlightedLine
          text={beforeText}
          spans={beforeHighlights}
          highlightClass={HIGHLIGHT_BEFORE}
          bodyClass={lineClass}
          as="span"
        />
        <span className="px-1 text-notion-text-light" aria-hidden>
          →
        </span>
        <HighlightedLine
          text={afterText}
          spans={afterHighlights}
          highlightClass={HIGHLIGHT_AFTER}
          bodyClass={`${lineClass} text-notion-text`}
          as="span"
        />
      </span>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="min-w-0">
        <p className={`mb-1 ${PANEL_TYPOGRAPHY.meta} font-medium text-notion-text-muted`}>改前</p>
        <div className="rounded-md bg-white/70 px-2 py-1.5">
          <HighlightedLine
            text={beforeText}
            spans={beforeHighlights}
            highlightClass={HIGHLIGHT_BEFORE}
            bodyClass={`whitespace-pre-wrap break-words ${PANEL_TYPOGRAPHY.dialogBody}`}
          />
        </div>
      </div>
      <div className="min-w-0">
        <p className={`mb-1 ${PANEL_TYPOGRAPHY.meta} font-medium text-notion-text-muted`}>改后</p>
        <div className="rounded-md bg-white/70 px-2 py-1.5">
          <HighlightedLine
            text={afterText}
            spans={afterHighlights}
            highlightClass={HIGHLIGHT_AFTER}
            bodyClass={`whitespace-pre-wrap break-words ${PANEL_TYPOGRAPHY.dialogText}`}
          />
        </div>
      </div>
    </div>
  );
}

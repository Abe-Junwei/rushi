import type { CorrectionHighlightSpan } from "./segmentCorrectionRulesApply";
import { splitGraphemes } from "../text/grapheme";
import { extractSingleTextDiffParts } from "../../utils/textDiff";

/** 与 Welcome / 查找替换 snippet 一致。 */
export const DEFAULT_CHANGE_SNIPPET_CONTEXT_CHARS = 24;

export type ChangeDisplaySnippet = {
  displayText: string;
  highlightStartG: number;
  highlightEndG: number;
};

export type TextChangeDisplaySnippets = {
  before: ChangeDisplaySnippet;
  after: ChangeDisplaySnippet;
};

export type TextChangePreviewHighlights = {
  beforeText: string;
  afterText: string;
  beforeHighlights: CorrectionHighlightSpan[];
  afterHighlights: CorrectionHighlightSpan[];
};

function buildSnippetAroundGraphemeRange(
  text: string,
  highlightStartG: number,
  highlightEndG: number,
  contextChars: number,
): ChangeDisplaySnippet {
  const glyphs = splitGraphemes(text);
  if (!glyphs.length) {
    return { displayText: "（空）", highlightStartG: 0, highlightEndG: 0 };
  }

  const safeStart = Math.max(0, Math.min(highlightStartG, glyphs.length));
  const safeEnd = Math.max(safeStart, Math.min(highlightEndG, glyphs.length));
  const left =
    safeStart === safeEnd
      ? Math.max(0, safeStart - contextChars)
      : Math.max(0, safeStart - contextChars);
  const right =
    safeStart === safeEnd
      ? Math.min(glyphs.length, safeStart + contextChars)
      : Math.min(glyphs.length, safeEnd + contextChars);

  const prefixEllipsis = left > 0 ? "…" : "";
  const suffixEllipsis = right < glyphs.length ? "…" : "";
  const displayText = `${prefixEllipsis}${glyphs.slice(left, right).join("")}${suffixEllipsis}`;
  const ellipsisG = prefixEllipsis ? 1 : 0;
  const highlightStartGInDisplay = ellipsisG + (safeStart - left);
  const highlightEndGInDisplay = highlightStartGInDisplay + (safeEnd - safeStart);

  return {
    displayText,
    highlightStartG: highlightStartGInDisplay,
    highlightEndG: highlightEndGInDisplay,
  };
}

/** 以最小改区为中心截取 before/after 上下文；高亮为 snippet 内字素区间。 */
export function buildTextChangeDisplaySnippets(
  before: string,
  after: string,
  opts?: { contextChars?: number },
): TextChangeDisplaySnippets | null {
  const parts = extractSingleTextDiffParts(before, after);
  if (!parts) return null;

  const contextChars = opts?.contextChars ?? DEFAULT_CHANGE_SNIPPET_CONTEXT_CHARS;
  const prefixG = splitGraphemes(parts.prefix).length;
  const beforeEndG = prefixG + splitGraphemes(parts.removed).length;
  const afterEndG = prefixG + splitGraphemes(parts.inserted).length;

  const beforeSnippet = buildSnippetAroundGraphemeRange(
    before,
    prefixG,
    beforeEndG,
    contextChars,
  );
  const afterSnippet = buildSnippetAroundGraphemeRange(after, prefixG, afterEndG, contextChars);

  return { before: beforeSnippet, after: afterSnippet };
}

function snippetToHighlightSpan(snippet: ChangeDisplaySnippet): CorrectionHighlightSpan[] {
  if (snippet.highlightEndG <= snippet.highlightStartG) return [];
  return [{ startG: snippet.highlightStartG, endG: snippet.highlightEndG }];
}

/** 供浮窗 preview：`CorrectionRulesChangeText variant="snippet"`。 */
export function buildTextChangePreviewHighlights(
  before: string,
  after: string,
  opts?: { contextChars?: number },
): TextChangePreviewHighlights {
  const snippets = buildTextChangeDisplaySnippets(before, after, opts);
  if (!snippets) {
    return {
      beforeText: before || "（空）",
      afterText: after || "（空）",
      beforeHighlights: [],
      afterHighlights: [],
    };
  }
  return {
    beforeText: snippets.before.displayText,
    afterText: snippets.after.displayText,
    beforeHighlights: snippetToHighlightSpan(snippets.before),
    afterHighlights: snippetToHighlightSpan(snippets.after),
  };
}

/** 全文改区字素高亮（规则纠错 wrap 真源）。 */
export function diffToCorrectionHighlights(
  before: string,
  after: string,
): { beforeHighlights: CorrectionHighlightSpan[]; afterHighlights: CorrectionHighlightSpan[] } {
  const parts = extractSingleTextDiffParts(before, after);
  if (!parts) return { beforeHighlights: [], afterHighlights: [] };
  const prefixG = splitGraphemes(parts.prefix).length;
  const removedG = splitGraphemes(parts.removed).length;
  const insertedG = splitGraphemes(parts.inserted).length;
  return {
    beforeHighlights: removedG > 0 ? [{ startG: prefixG, endG: prefixG + removedG }] : [],
    afterHighlights: insertedG > 0 ? [{ startG: prefixG, endG: prefixG + insertedG }] : [],
  };
}

export type TextChangeRowDisplay = {
  variant: "snippet" | "wrap";
  beforeText: string;
  afterText: string;
  beforeHighlights: CorrectionHighlightSpan[];
  afterHighlights: CorrectionHighlightSpan[];
};

/** 浮窗列表行：默认 snippet；聚焦行展开全文 wrap + diff 高亮。 */
export function resolveTextChangeRowDisplay(
  before: string,
  after: string,
  opts?: { focused?: boolean; contextChars?: number },
): TextChangeRowDisplay {
  if (opts?.focused) {
    const { beforeHighlights, afterHighlights } = diffToCorrectionHighlights(before, after);
    return {
      variant: "wrap",
      beforeText: before || "（空）",
      afterText: after || "（空）",
      beforeHighlights,
      afterHighlights,
    };
  }
  const preview = buildTextChangePreviewHighlights(before, after, opts);
  return { variant: "snippet", ...preview };
}

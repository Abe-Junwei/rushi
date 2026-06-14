/** Unicode 字素（grapheme）切分；中文 BMP 与 emoji 扩展区均按可见字处理。 */

type GraphemeSegmenter = {
  segment(input: string): Iterable<{ segment: string }>;
};

let graphemeSegmenter: GraphemeSegmenter | null | undefined;

function getGraphemeSegmenter(): GraphemeSegmenter | null {
  if (graphemeSegmenter !== undefined) return graphemeSegmenter;
  const IntlWithSegmenter = Intl as typeof Intl & {
    Segmenter?: new (
      locale: string,
      options: { granularity: "grapheme" },
    ) => GraphemeSegmenter;
  };
  if (typeof IntlWithSegmenter.Segmenter === "function") {
    graphemeSegmenter = new IntlWithSegmenter.Segmenter("zh", { granularity: "grapheme" });
  } else {
    graphemeSegmenter = null;
  }
  return graphemeSegmenter;
}

export function splitGraphemes(text: string): string[] {
  if (!text) return [];
  const segmenter = getGraphemeSegmenter();
  if (segmenter) {
    return [...segmenter.segment(text)].map((part) => part.segment);
  }
  return [...text];
}

export function graphemeCount(text: string): number {
  return splitGraphemes(text).length;
}

export function sliceGraphemes(text: string, start: number, end?: number): string {
  const glyphs = splitGraphemes(text);
  return glyphs.slice(start, end).join("");
}

/** 在字素数组索引处切分（供 diff / 规则扫描使用）。 */
export function graphemeIndexToCodeUnitOffset(text: string, graphemeIndex: number): number {
  if (graphemeIndex <= 0) return 0;
  let offset = 0;
  let count = 0;
  const segmenter = getGraphemeSegmenter();
  if (segmenter) {
    for (const part of segmenter.segment(text)) {
      if (count >= graphemeIndex) break;
      offset += part.segment.length;
      count += 1;
    }
    return offset;
  }
  return Math.min(graphemeIndex, text.length);
}

function lastGrapheme(text: string): string | undefined {
  const glyphs = splitGraphemes(text);
  return glyphs[glyphs.length - 1];
}

lastGrapheme;

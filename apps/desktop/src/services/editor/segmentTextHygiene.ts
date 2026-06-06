/** A6：语段正文确定性清洗（NFKC / 标点全角 / 空白 / 重复标点）。 */

const FULLWIDTH_ASCII_OFFSET = 0xfee0;
const FULLWIDTH_DIGIT_START = 0xff10;
const FULLWIDTH_DIGIT_END = 0xff19;
const FULLWIDTH_LATIN_UPPER_START = 0xff21;
const FULLWIDTH_LATIN_UPPER_END = 0xff3a;
const FULLWIDTH_LATIN_LOWER_START = 0xff41;
const FULLWIDTH_LATIN_LOWER_END = 0xff5a;
const FULLWIDTH_SPACE = "\u3000";
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff]/;

/** 半角 ASCII 标点 → 中文全角标点（数字内 `.`/`:` 保留）。 */
const HALF_TO_FULL_PUNCT: Record<string, string> = {
  ",": "，",
  "!": "！",
  "?": "？",
  ";": "；",
  ":": "：",
  "(": "（",
  ")": "）",
  "[": "［",
  "]": "］",
  "{": "｛",
  "}": "｝",
  "-": "－",
  "~": "～",
};

const DUPLICATE_PUNCTUATION_RE =
  /([，。！？；：、…—－,.!?;:\-])\1+/gu;

function isDecimalOrTimeDot(before: string, after: string): boolean {
  return /\d$/.test(before) && /^\d/.test(after);
}

function isDecimalOrTimeColon(before: string, after: string): boolean {
  return /\d$/.test(before) && /^\d/.test(after);
}

function isAdjacentToCjk(before: string, after: string): boolean {
  return CJK_RE.test(before) || CJK_RE.test(after);
}

/** 半角标点统一为全角；与阶段 B / 中文排版一致。 */
export function normalizeHalfWidthPunctuationToFullWidth(text: string): string {
  const withEllipsis = text.replace(/\.{2,}/g, "…");
  let out = "";
  for (let i = 0; i < withEllipsis.length; i++) {
    const ch = withEllipsis[i]!;
    const before = withEllipsis[i - 1] ?? "";
    const after = withEllipsis[i + 1] ?? "";

    if (ch === ".") {
      if (isDecimalOrTimeDot(before, after)) {
        out += ch;
        continue;
      }
      if (isAdjacentToCjk(before, after) || !before || !after) {
        out += "。";
        continue;
      }
      out += ch;
      continue;
    }

    if (ch === ":" && isDecimalOrTimeColon(before, after)) {
      out += ch;
      continue;
    }

    const mapped = HALF_TO_FULL_PUNCT[ch];
    if (mapped) {
      out += mapped;
      continue;
    }

    out += ch;
  }

  return out;
}

/** 全角字母数字 → 半角；全角空格 → 普通空格（不改全角标点）。 */
export function normalizeFullWidthAlphanumeric(text: string): string {
  let out = "";
  for (const ch of text) {
    if (ch === FULLWIDTH_SPACE) {
      out += " ";
      continue;
    }
    const code = ch.charCodeAt(0);
    const isDigit = code >= FULLWIDTH_DIGIT_START && code <= FULLWIDTH_DIGIT_END;
    const isUpper = code >= FULLWIDTH_LATIN_UPPER_START && code <= FULLWIDTH_LATIN_UPPER_END;
    const isLower = code >= FULLWIDTH_LATIN_LOWER_START && code <= FULLWIDTH_LATIN_LOWER_END;
    if (isDigit || isUpper || isLower) {
      out += String.fromCharCode(code - FULLWIDTH_ASCII_OFFSET);
      continue;
    }
    out += ch;
  }
  return out;
}

/** @deprecated 使用 normalizeFullWidthAlphanumeric + normalizeHalfWidthPunctuationToFullWidth */
export function normalizeFullWidthAscii(text: string): string {
  return normalizeFullWidthAlphanumeric(text);
}

/** 连续空白压成单空格；保留换行。 */
export function collapseConsecutiveWhitespace(text: string): string {
  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *(\n+) */g, "$1")
    .replace(/^ +| +$/g, "");
}

/** 连续相同标点压成 1 个。 */
export function collapseDuplicatePunctuation(text: string): string {
  return text.replace(DUPLICATE_PUNCTUATION_RE, "$1");
}

/** 对单段正文执行 A6 hygiene；无变化则返回原文引用相等值。 */
export function applySegmentTextHygiene(text: string): string {
  let out = text.normalize("NFKC");
  out = normalizeHalfWidthPunctuationToFullWidth(out);
  out = normalizeFullWidthAlphanumeric(out);
  out = collapseConsecutiveWhitespace(out);
  out = collapseDuplicatePunctuation(out);
  return out;
}

export function segmentTextHygieneChanged(before: string, after: string): boolean {
  return before !== after;
}

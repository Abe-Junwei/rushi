import { splitGraphemes } from "./text/grapheme";

/** 与缓存指纹绑定； hygiene 规则变更时递增以失效旧预览。 */
export const EXPORT_POLISH_HYGIENE_REV = "h1";

const ORAL_FILLER_RE = /([啊呃嗯喔噢呜哇鹅])\1+/gu;

/** 连续 3+ 相同汉字压成 1 字（喔喔喔、鹅鹅鹅）。 */
export function collapseOralStutter(text: string): string {
  const glyphs = splitGraphemes(text);
  if (glyphs.length === 0) return text;
  const out: string[] = [];
  let i = 0;
  while (i < glyphs.length) {
    const g = glyphs[i] ?? "";
    let run = 1;
    while (i + run < glyphs.length && glyphs[i + run] === g) run += 1;
    out.push(g);
    i += run >= 3 ? run : 1;
  }
  return out.join("");
}

/** 口语填充音连写（啊啊啊 → 啊）。 */
export function collapseOralFillerRuns(text: string): string {
  return text.replace(ORAL_FILLER_RE, "$1");
}

/** 导出润色确定性清洗（不依赖 LLM）。 */
export function applyExportPolishHygiene(lines: string[]): string[] {
  return lines.map((line) => collapseOralFillerRuns(collapseOralStutter(line)));
}

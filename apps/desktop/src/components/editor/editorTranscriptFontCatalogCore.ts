export const DEFAULT_FONT_OPTIONS = ["PingFang SC", "Songti SC", "Hiragino Sans GB", "Noto Sans CJK SC"];

/** 探测字体是否真正覆盖中文（非仅 Latin 回退）。 */
export const CJK_FONT_PROBE = "语段";

const CJK_FONT_NAME_HINT =
  /(?:SC|TC|HK|JP|KR|CJK|Han|PingFang|Songti|Heiti|Kaiti|Noto Sans|Noto Serif|Source Han|Hiragino|WenKai|YaHei|SimSun|SimHei|FangSong|KaiTi|MiSans|HarmonyOS|Alibaba|Smiley|STSong|STHeiti|STKaiti|STFangsong|Segoe UI)/i;

export const TRANSCRIPT_META_WIDTH_STORAGE_KEY = "rushi.editor.transcript.metaWidthPx";
export const TRANSCRIPT_FONT_FAMILY_STORAGE_KEY = "rushi.editor.transcript.fontFamily";
export const TRANSCRIPT_FONT_WEIGHT_STORAGE_KEY = "rushi.editor.transcript.fontWeight";
export const TRANSCRIPT_FONT_ITALIC_STORAGE_KEY = "rushi.editor.transcript.fontItalic";
export const TRANSCRIPT_META_WIDTH_MIN = 104;
export const TRANSCRIPT_META_WIDTH_MAX = 260;

export const SYSTEM_FONT_CANDIDATES = [
  "PingFang SC",
  "PingFang TC",
  "PingFang HK",
  "Songti SC",
  "Songti TC",
  "Heiti SC",
  "Heiti TC",
  "Kaiti SC",
  "Kaiti TC",
  "STSong",
  "STHeiti",
  "STKaiti",
  "STFangsong",
  "Hiragino Sans GB",
  "Hiragino Sans CNS",
  "Hiragino Mincho ProN",
  "Noto Sans CJK SC",
  "Noto Sans SC",
  "Noto Sans TC",
  "Noto Sans HK",
  "Noto Sans JP",
  "Noto Serif SC",
  "Noto Serif TC",
  "Noto Serif JP",
  "Source Han Sans SC",
  "Source Han Sans CN",
  "Source Han Sans TC",
  "Source Han Sans",
  "Source Han Serif SC",
  "Source Han Serif CN",
  "Source Han Serif TC",
  "Source Han Serif",
  "LXGW WenKai",
  "Smiley Sans",
  "Alibaba PuHuiTi",
  "HarmonyOS Sans SC",
  "MiSans",
  "OPPOSans",
  "Segoe UI",
  "Microsoft YaHei",
  "SimSun",
  "SimHei",
  "NSimSun",
  "FangSong",
  "KaiTi",
  "Arial",
  "Helvetica Neue",
  "SF Pro Text",
  "SF Pro Display",
  "Avenir Next",
  "Times New Roman",
  "Georgia",
  "Menlo",
  "Monaco",
  "Fira Code",
  "Inter",
] as const;

export type LocalFontFaceMetadata = {
  family?: string;
  fullName?: string;
  postscriptName?: string;
  style?: string;
};

export type TranscriptFontCatalog = {
  families: string[];
  displayLabels: Record<string, string>;
};

export function normalizeFontFamily(raw: string): string {
  return raw.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "").trim();
}

export function fontFamilyNameHintsCjk(family: string): boolean {
  return CJK_FONT_NAME_HINT.test(normalizeFontFamily(family));
}

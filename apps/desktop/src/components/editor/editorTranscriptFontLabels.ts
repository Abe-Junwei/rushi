import { normalizeFontFamily } from "./editorTranscriptFontCatalogCore";

/** 系统字族 → 子菜单中文展示名（CSS font-family 仍用英文 key）。 */
export const TRANSCRIPT_FONT_FAMILY_ZH_LABELS: Record<string, string> = {
  "PingFang SC": "苹方-简",
  "PingFang TC": "苹方-繁",
  "PingFang HK": "苹方-港",
  "Songti SC": "宋体-简",
  "Songti TC": "宋体-繁",
  "Heiti SC": "黑体-简",
  "Heiti TC": "黑体-繁",
  "Kaiti SC": "楷体-简",
  "Kaiti TC": "楷体-繁",
  STSong: "华文宋体",
  STHeiti: "华文黑体",
  STKaiti: "华文楷体",
  STFangsong: "华文仿宋",
  "Hiragino Sans GB": "冬青黑体-简",
  "Hiragino Sans CNS": "冬青黑体-繁",
  "Hiragino Mincho ProN": "冬青明朝",
  "Noto Sans CJK SC": "思源黑体-简",
  "Noto Sans SC": "思源黑体-简",
  "Noto Sans TC": "思源黑体-繁",
  "Noto Sans HK": "思源黑体-港",
  "Noto Sans JP": "思源黑体-日",
  "Noto Serif SC": "思源宋体-简",
  "Noto Serif TC": "思源宋体-繁",
  "Noto Serif JP": "思源宋体-日",
  "Source Han Sans SC": "思源黑体-简",
  "Source Han Sans CN": "思源黑体-简",
  "Source Han Sans TC": "思源黑体-繁",
  "Source Han Sans": "思源黑体",
  "Source Han Serif SC": "思源宋体-简",
  "Source Han Serif CN": "思源宋体-简",
  "Source Han Serif TC": "思源宋体-繁",
  "Source Han Serif": "思源宋体",
  "LXGW WenKai": "霞鹜文楷",
  "Smiley Sans": "得意黑",
  "Alibaba PuHuiTi": "阿里巴巴普惠体",
  "HarmonyOS Sans SC": "鸿蒙无衬线-简",
  MiSans: "小米无衬线",
  OPPOSans: "OPPO 无衬线",
  "Segoe UI": "Segoe 用户界面",
  "Microsoft YaHei": "微软雅黑",
  SimSun: "宋体",
  SimHei: "黑体",
  NSimSun: "新宋体",
  FangSong: "仿宋",
  KaiTi: "楷体",
};

const TRANSCRIPT_FONT_BASE_ZH_LABELS: Record<string, string> = {
  PingFang: "苹方",
  Songti: "宋体",
  Heiti: "黑体",
  Kaiti: "楷体",
  "Noto Sans": "思源黑体",
  "Noto Serif": "思源宋体",
  "Source Han Sans": "思源黑体",
  "Source Han Serif": "思源宋体",
  "HarmonyOS Sans": "鸿蒙 Sans",
  Yuanti: "圆体",
  Baoli: "报隶",
  Lantinghei: "兰亭黑",
  Libian: "隶变",
  Wawati: "娃娃体",
  Weibei: "魏碑",
  Xingkai: "行楷",
  "Hannotate SC": "手札体-简",
  "HanziPen SC": "翩翩体-简",
  "Hiragino Sans": "冬青黑体",
};

const TRANSCRIPT_FONT_REGION_ZH: Record<string, string> = {
  SC: "简",
  TC: "繁",
  HK: "港",
  JP: "日",
  KR: "韩",
  CN: "简",
  GB: "简",
  CNS: "繁",
};

export function transcriptFontFamilyDisplayLabel(family: string): string {
  const normalized = normalizeFontFamily(family);
  if (!normalized) return "默认字体";

  const exact = TRANSCRIPT_FONT_FAMILY_ZH_LABELS[normalized];
  if (exact) return exact;

  if (/[\u4e00-\u9fff]/.test(normalized)) return normalized;

  for (const [base, zhBase] of Object.entries(TRANSCRIPT_FONT_BASE_ZH_LABELS)) {
    if (normalized === base) return zhBase;
    for (const [region, zhRegion] of Object.entries(TRANSCRIPT_FONT_REGION_ZH)) {
      const suffix = ` ${region}`;
      if (!normalized.endsWith(suffix)) continue;
      const prefix = normalized.slice(0, normalized.length - suffix.length);
      if (prefix === base || prefix.startsWith(`${base} `)) {
        return `${zhBase}-${zhRegion}`;
      }
    }
    if (normalized.startsWith(`${base} `)) {
      const tail = normalized.slice(base.length + 1);
      const zhRegion = TRANSCRIPT_FONT_REGION_ZH[tail];
      if (zhRegion) return `${zhBase}-${zhRegion}`;
    }
  }

  const regionMatch = normalized.match(/^(.+?) (?:CJK )?(SC|TC|HK|JP|KR|CN|GB|CNS)$/i);
  if (regionMatch) {
    const [, baseName, region] = regionMatch;
    const zhRegion = TRANSCRIPT_FONT_REGION_ZH[region.toUpperCase()];
    const mappedBase = TRANSCRIPT_FONT_BASE_ZH_LABELS[baseName] ?? baseName;
    if (zhRegion) return `${mappedBase}-${zhRegion}`;
  }

  return normalized;
}

export function transcriptFontFamilyCssStack(family: string): string {
  const normalized = normalizeFontFamily(family);
  if (!normalized) {
    return '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", system-ui, sans-serif';
  }
  return `"${normalized}", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", system-ui, sans-serif`;
}

export function resolveTranscriptFontDisplayLabel(
  family: string,
  nativeLabels?: Readonly<Record<string, string>>,
): string {
  const normalized = normalizeFontFamily(family);
  const native = nativeLabels?.[normalized];
  if (native) return native;
  return transcriptFontFamilyDisplayLabel(family);
}

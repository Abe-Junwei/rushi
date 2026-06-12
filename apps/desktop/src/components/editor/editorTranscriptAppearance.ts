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

export function readStoredTranscriptFontFamily(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TRANSCRIPT_FONT_FAMILY_STORAGE_KEY);
    if (raw == null || raw === "") return null;
    const normalized = normalizeFontFamily(raw);
    return normalized || null;
  } catch {
    return null;
  }
}

export function writeStoredTranscriptFontFamily(family: string): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeFontFamily(family);
    if (!normalized) return;
    window.localStorage.setItem(TRANSCRIPT_FONT_FAMILY_STORAGE_KEY, normalized);
  } catch {
    /* noop */
  }
}

export function readStoredTranscriptFontWeight(): 500 | 700 {
  if (typeof window === "undefined") return 500;
  try {
    const raw = window.localStorage.getItem(TRANSCRIPT_FONT_WEIGHT_STORAGE_KEY);
    if (raw === "700") return 700;
    return 500;
  } catch {
    return 500;
  }
}

export function writeStoredTranscriptFontWeight(weight: 500 | 700): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRANSCRIPT_FONT_WEIGHT_STORAGE_KEY, String(weight));
  } catch {
    /* noop */
  }
}

export function readStoredTranscriptFontItalic(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(TRANSCRIPT_FONT_ITALIC_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return false;
  } catch {
    return false;
  }
}

export function writeStoredTranscriptFontItalic(italic: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRANSCRIPT_FONT_ITALIC_STORAGE_KEY, italic ? "1" : "0");
  } catch {
    /* noop */
  }
}

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

export function normalizeFontFamily(raw: string): string {
  return raw.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "").trim();
}

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

const POSTSCRIPT_STYLE_SUFFIX =
  /[-_.]?(Regular|Italic|Oblique|Bold|Light|Medium|Semibold|SemiBold|Heavy|Black|Thin|ExtraLight|UltraLight|DemiBold|Demi|Condensed|Extended|MT)$/i;

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

export function canonicalFontFamilyKey(name: string): string {
  return normalizeFontFamily(name).replace(/\s+/g, "");
}

export function postscriptFamilyKey(postscriptName: string): string {
  let key = normalizeFontFamily(postscriptName).replace(/\s+/g, "");
  let prev = "";
  while (key !== prev) {
    prev = key;
    key = key.replace(POSTSCRIPT_STYLE_SUFFIX, "");
  }
  return key;
}

/** 优先采用字体 name 表里、随系统语言返回的中文 family / fullName。 */
export function pickFontMenuLabelFromMetadata(family: string, fullName?: string): string | null {
  const normalizedFamily = normalizeFontFamily(family);
  const normalizedFull = normalizeFontFamily(fullName ?? "");
  if (/[\u4e00-\u9fff]/.test(normalizedFamily)) return normalizedFamily;
  if (/[\u4e00-\u9fff]/.test(normalizedFull)) return normalizedFull;
  return null;
}

function preferChineseLabel(current: string | undefined, next: string): string {
  if (!current) return next;
  if (/[\u4e00-\u9fff]/.test(current)) return current;
  if (/[\u4e00-\u9fff]/.test(next)) return next;
  return current;
}

export function buildLocalFontLabelIndex(localFonts: ReadonlyArray<LocalFontFaceMetadata>): {
  byPostscriptKey: Map<string, string>;
  byCssFamily: Map<string, string>;
} {
  const byPostscriptKey = new Map<string, string>();
  const byCssFamily = new Map<string, string>();

  for (const font of localFonts) {
    const label = pickFontMenuLabelFromMetadata(font.family ?? "", font.fullName);
    if (!label) continue;

    const cssFamily = normalizeFontFamily(font.family ?? "");
    if (cssFamily) {
      byCssFamily.set(cssFamily, preferChineseLabel(byCssFamily.get(cssFamily), label));
    }

    const psKey = postscriptFamilyKey(font.postscriptName ?? "");
    if (psKey) {
      byPostscriptKey.set(psKey, preferChineseLabel(byPostscriptKey.get(psKey), label));
    }
  }

  return { byPostscriptKey, byCssFamily };
}

export function resolveNativeFontDisplayLabel(
  family: string,
  index: { byPostscriptKey: Map<string, string>; byCssFamily: Map<string, string> },
): string | null {
  const normalized = normalizeFontFamily(family);
  if (!normalized) return null;

  const direct = index.byCssFamily.get(normalized);
  if (direct) return direct;

  const familyKey = canonicalFontFamilyKey(normalized);
  const exact = index.byPostscriptKey.get(familyKey);
  if (exact) return exact;

  for (const [psKey, label] of index.byPostscriptKey) {
    if (psKey.startsWith(familyKey) || familyKey.startsWith(psKey)) return label;
  }

  return null;
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

function localFontDuplicatesCandidate(font: LocalFontFaceMetadata, candidateFamily: string): boolean {
  const psKey = postscriptFamilyKey(font.postscriptName ?? "");
  if (!psKey) return false;
  const candidateKey = canonicalFontFamilyKey(candidateFamily);
  return psKey === candidateKey || psKey.startsWith(candidateKey) || candidateKey.startsWith(psKey);
}

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

export function fontFamilyNameHintsCjk(family: string): boolean {
  return CJK_FONT_NAME_HINT.test(normalizeFontFamily(family));
}

export function fontFamilySupportsCjkText(
  family: string,
  fonts: Pick<FontFaceSet, "check"> = typeof document !== "undefined" ? document.fonts : { check: () => false },
): boolean {
  const normalized = normalizeFontFamily(family);
  if (!normalized) return false;
  const spec = `16px "${normalized}"`;
  try {
    return fonts.check(spec, CJK_FONT_PROBE);
  } catch {
    return false;
  }
}

export async function ensureFontLoadedForCjkProbe(
  family: string,
  fonts: Pick<FontFaceSet, "check" | "load"> = typeof document !== "undefined"
    ? document.fonts
    : { check: () => false, load: () => Promise.resolve([]) },
): Promise<boolean> {
  const normalized = normalizeFontFamily(family);
  if (!normalized) return false;
  const spec = `16px "${normalized}"`;
  try {
    await fonts.load(spec, CJK_FONT_PROBE);
  } catch {
    // ignore load errors; check may still succeed for system fonts
  }
  return fontFamilySupportsCjkText(normalized, fonts);
}

export async function buildTranscriptFontOptions(args: {
  queryLocalFonts?: () => Promise<LocalFontFaceMetadata[]>;
  fonts?: Pick<FontFaceSet, "check" | "load">;
  storedFamily?: string | null;
}): Promise<TranscriptFontCatalog> {
  const fonts = args.fonts ?? (typeof document !== "undefined" ? document.fonts : undefined);
  const emptyCatalog = (): TranscriptFontCatalog => ({
    families: [...DEFAULT_FONT_OPTIONS],
    displayLabels: Object.fromEntries(
      DEFAULT_FONT_OPTIONS.map((family) => [family, transcriptFontFamilyDisplayLabel(family)]),
    ),
  });
  if (!fonts) return emptyCatalog();

  const discovered = new Set<string>();
  const displayLabels: Record<string, string> = {};
  let localFontIndex = { byPostscriptKey: new Map<string, string>(), byCssFamily: new Map<string, string>() };
  let localFonts: LocalFontFaceMetadata[] = [];

  try {
    if (args.queryLocalFonts) {
      localFonts = await args.queryLocalFonts();
      localFontIndex = buildLocalFontLabelIndex(localFonts);
      for (const font of localFonts) {
        const family = normalizeFontFamily(font.family ?? "");
        if (!family || !fontFamilyNameHintsCjk(family)) continue;
        if (!fontFamilySupportsCjkText(family, fonts)) continue;
        if (SYSTEM_FONT_CANDIDATES.some((candidate) => localFontDuplicatesCandidate(font, candidate))) {
          continue;
        }
        discovered.add(family);
      }
    }
  } catch {
    // ignore local font permission or runtime errors
  }

  const candidateChecks = await Promise.all(
    SYSTEM_FONT_CANDIDATES.map(async (family) => ({
      family,
      ok: await ensureFontLoadedForCjkProbe(family, fonts),
    })),
  );
  for (const { family, ok } of candidateChecks) {
    if (ok) discovered.add(family);
  }

  const stored = normalizeFontFamily(args.storedFamily ?? "");
  if (stored && !discovered.has(stored)) {
    if (await ensureFontLoadedForCjkProbe(stored, fonts)) discovered.add(stored);
  }

  const preferred = SYSTEM_FONT_CANDIDATES.filter((f) => discovered.has(f));
  const extras = Array.from(discovered)
    .filter((f) => !preferred.includes(f as (typeof SYSTEM_FONT_CANDIDATES)[number]))
    .sort((a, b) => {
      const labelA = resolveNativeFontDisplayLabel(a, localFontIndex) ?? transcriptFontFamilyDisplayLabel(a);
      const labelB = resolveNativeFontDisplayLabel(b, localFontIndex) ?? transcriptFontFamilyDisplayLabel(b);
      return labelA.localeCompare(labelB, "zh-Hans-CN");
    });
  const merged = [...preferred, ...extras];

  for (const family of merged) {
    const native = resolveNativeFontDisplayLabel(family, localFontIndex);
    displayLabels[family] = native ?? transcriptFontFamilyDisplayLabel(family);
  }

  if (merged.length === 0) return emptyCatalog();
  return { families: merged, displayLabels };
}

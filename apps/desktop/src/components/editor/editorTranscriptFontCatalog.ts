import {
  normalizeFontFamily,
  type LocalFontFaceMetadata,
  type TranscriptFontCatalog,
} from "./editorTranscriptFontCatalogCore";

export * from "./editorTranscriptFontCatalogCore";
export * from "./editorTranscriptFontLabels";

const POSTSCRIPT_STYLE_SUFFIX =
  /[-_.]?(Regular|Italic|Oblique|Bold|Light|Medium|Semibold|SemiBold|Heavy|Black|Thin|ExtraLight|UltraLight|DemiBold|Demi|Condensed|Extended|MT)$/i;

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

export function localFontDuplicatesCandidate(font: LocalFontFaceMetadata, candidateFamily: string): boolean {
  const psKey = postscriptFamilyKey(font.postscriptName ?? "");
  if (!psKey) return false;
  const candidateKey = canonicalFontFamilyKey(candidateFamily);
  return psKey === candidateKey || psKey.startsWith(candidateKey) || candidateKey.startsWith(psKey);
}

export type { LocalFontFaceMetadata, TranscriptFontCatalog };

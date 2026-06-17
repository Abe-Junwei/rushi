import {
  DEFAULT_FONT_OPTIONS,
  type LocalFontFaceMetadata,
  type TranscriptFontCatalog,
  buildLocalFontLabelIndex,
  fontFamilyNameHintsCjk,
  localFontDuplicatesCandidate,
  normalizeFontFamily,
  resolveNativeFontDisplayLabel,
  SYSTEM_FONT_CANDIDATES,
  transcriptFontFamilyDisplayLabel,
  TRANSCRIPT_FONT_FAMILY_STORAGE_KEY,
  TRANSCRIPT_FONT_ITALIC_STORAGE_KEY,
  TRANSCRIPT_FONT_WEIGHT_STORAGE_KEY,
} from "./editorTranscriptFontCatalog";

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

export function fontFamilySupportsCjkText(
  family: string,
  fonts: Pick<FontFaceSet, "check"> = typeof document !== "undefined" ? document.fonts : { check: () => false },
): boolean {
  const normalized = normalizeFontFamily(family);
  if (!normalized) return false;
  const spec = `16px "${normalized}"`;
  try {
    return fonts.check(spec, "语段");
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
    await fonts.load(spec, "语段");
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

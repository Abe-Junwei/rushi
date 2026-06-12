import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildTranscriptFontOptions,
  DEFAULT_FONT_OPTIONS,
  normalizeFontFamily,
  readStoredTranscriptFontFamily,
  readStoredTranscriptFontItalic,
  readStoredTranscriptFontWeight,
  transcriptFontFamilyDisplayLabel,
  TRANSCRIPT_META_WIDTH_MAX,
  TRANSCRIPT_META_WIDTH_MIN,
  TRANSCRIPT_META_WIDTH_STORAGE_KEY,
  type LocalFontFaceMetadata,
  writeStoredTranscriptFontFamily,
  writeStoredTranscriptFontItalic,
  writeStoredTranscriptFontWeight,
} from "./editorTranscriptAppearance";

export function useEditorTranscriptAppearance(busy: boolean, hasCurrentFile: boolean) {
  const [fontOptions, setFontOptions] = useState<string[]>(DEFAULT_FONT_OPTIONS);
  const [fontDisplayLabels, setFontDisplayLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      DEFAULT_FONT_OPTIONS.map((family) => [family, transcriptFontFamilyDisplayLabel(family)]),
    ),
  );
  const [transcriptFontFamily, setTranscriptFontFamily] = useState(
    () => readStoredTranscriptFontFamily() ?? DEFAULT_FONT_OPTIONS[0],
  );
  const [fontLoadBusy, setFontLoadBusy] = useState(false);
  const [transcriptMetaWidthPx, setTranscriptMetaWidthPx] = useState<number>(() => {
    if (typeof window === "undefined") return 132;
    const raw = window.localStorage.getItem(TRANSCRIPT_META_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed)) return 132;
    return Math.max(TRANSCRIPT_META_WIDTH_MIN, Math.min(TRANSCRIPT_META_WIDTH_MAX, Math.round(parsed)));
  });
  const [transcriptFontWeight, setTranscriptFontWeight] = useState<500 | 700>(() =>
    readStoredTranscriptFontWeight(),
  );
  const [transcriptFontItalic, setTranscriptFontItalic] = useState(() => readStoredTranscriptFontItalic());

  const transcriptFontControlDisabled = useMemo(() => busy || !hasCurrentFile, [busy, hasCurrentFile]);

  const loadSystemFonts = useCallback(async () => {
    setFontLoadBusy(true);
    try {
      const localFontWindow = window as Window & {
        queryLocalFonts?: () => Promise<LocalFontFaceMetadata[]>;
      };
      const catalog = await buildTranscriptFontOptions({
        queryLocalFonts:
          typeof localFontWindow.queryLocalFonts === "function"
            ? () => localFontWindow.queryLocalFonts!()
            : undefined,
        storedFamily: readStoredTranscriptFontFamily(),
      });
      setFontOptions(catalog.families);
      setFontDisplayLabels(catalog.displayLabels);
      setTranscriptFontFamily((cur) => {
        const normalized = normalizeFontFamily(cur);
        if (catalog.families.includes(normalized)) return normalized;
        // 保留用户已选字体：列表异步加载完成前可能尚未收录，但 CSS 仍可生效。
        return normalized || catalog.families[0];
      });
    } finally {
      setFontLoadBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadSystemFonts();
  }, [loadSystemFonts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TRANSCRIPT_META_WIDTH_STORAGE_KEY, String(transcriptMetaWidthPx));
  }, [transcriptMetaWidthPx]);

  useEffect(() => {
    writeStoredTranscriptFontFamily(transcriptFontFamily);
  }, [transcriptFontFamily]);

  useEffect(() => {
    writeStoredTranscriptFontWeight(transcriptFontWeight);
  }, [transcriptFontWeight]);

  useEffect(() => {
    writeStoredTranscriptFontItalic(transcriptFontItalic);
  }, [transcriptFontItalic]);

  const beginTranscriptMetaWidthDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (busy) return;
      e.preventDefault();
      e.stopPropagation();

      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startWidth = transcriptMetaWidthPx;
      const handle = e.currentTarget;
      handle.setPointerCapture(pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const next = Math.max(
          TRANSCRIPT_META_WIDTH_MIN,
          Math.min(TRANSCRIPT_META_WIDTH_MAX, Math.round(startWidth + delta)),
        );
        setTranscriptMetaWidthPx(next);
      };

      const finish = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [busy, transcriptMetaWidthPx],
  );

  return {
    fontOptions,
    fontDisplayLabels,
    transcriptFontFamily,
    setTranscriptFontFamily,
    fontLoadBusy,
    transcriptMetaWidthPx,
    transcriptFontWeight,
    setTranscriptFontWeight,
    transcriptFontItalic,
    setTranscriptFontItalic,
    transcriptFontControlDisabled,
    loadSystemFonts,
    beginTranscriptMetaWidthDrag,
    normalizeFontFamily,
  };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_FONT_OPTIONS,
  normalizeFontFamily,
  SYSTEM_FONT_CANDIDATES,
  TRANSCRIPT_META_WIDTH_MAX,
  TRANSCRIPT_META_WIDTH_MIN,
  TRANSCRIPT_META_WIDTH_STORAGE_KEY,
} from "./editorTranscriptAppearance";

export function useEditorTranscriptAppearance(busy: boolean, hasCurrentFile: boolean) {
  const [fontOptions, setFontOptions] = useState<string[]>(DEFAULT_FONT_OPTIONS);
  const [transcriptFontFamily, setTranscriptFontFamily] = useState(DEFAULT_FONT_OPTIONS[0]);
  const [fontLoadBusy, setFontLoadBusy] = useState(false);
  const [transcriptMetaWidthPx, setTranscriptMetaWidthPx] = useState<number>(() => {
    if (typeof window === "undefined") return 132;
    const raw = window.localStorage.getItem(TRANSCRIPT_META_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed)) return 132;
    return Math.max(TRANSCRIPT_META_WIDTH_MIN, Math.min(TRANSCRIPT_META_WIDTH_MAX, Math.round(parsed)));
  });
  const [transcriptFontWeight, setTranscriptFontWeight] = useState<500 | 700>(500);
  const [transcriptFontItalic, setTranscriptFontItalic] = useState(false);

  const transcriptFontControlDisabled = useMemo(() => busy || !hasCurrentFile, [busy, hasCurrentFile]);

  const loadSystemFonts = useCallback(async () => {
    setFontLoadBusy(true);
    const discovered = new Set<string>();

    try {
      const localFontWindow = window as Window & {
        queryLocalFonts?: () => Promise<Array<{ family?: string }>>;
      };
      if (typeof localFontWindow.queryLocalFonts === "function") {
        const localFonts = await localFontWindow.queryLocalFonts();
        for (const f of localFonts) {
          const family = normalizeFontFamily(f.family ?? "");
          if (family) discovered.add(family);
        }
      }
    } catch {
      // ignore local font permission or runtime errors
    }

    for (const family of SYSTEM_FONT_CANDIDATES) {
      try {
        if (document.fonts.check(`12px "${family}"`)) discovered.add(family);
      } catch {
        // ignore check errors
      }
    }

    const preferred = SYSTEM_FONT_CANDIDATES.filter((f) => discovered.has(f));
    const extras = Array.from(discovered)
      .filter((f) => !preferred.includes(f as (typeof SYSTEM_FONT_CANDIDATES)[number]))
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    const merged = [...preferred, ...extras];
    const nextOptions = merged.length > 0 ? merged : DEFAULT_FONT_OPTIONS;

    setFontOptions(nextOptions);
    setTranscriptFontFamily((cur) => {
      const normalized = normalizeFontFamily(cur);
      if (nextOptions.includes(normalized)) return normalized;
      return nextOptions[0];
    });
    setFontLoadBusy(false);
  }, []);

  useEffect(() => {
    void loadSystemFonts();
  }, [loadSystemFonts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TRANSCRIPT_META_WIDTH_STORAGE_KEY, String(transcriptMetaWidthPx));
  }, [transcriptMetaWidthPx]);

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

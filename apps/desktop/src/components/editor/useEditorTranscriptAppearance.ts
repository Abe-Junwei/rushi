import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildTranscriptFontOptions,
  DEFAULT_FONT_OPTIONS,
  normalizeFontFamily,
  readStoredTranscriptFontFamily,
  readStoredTranscriptFontItalic,
  readStoredTranscriptFontWeight,
  transcriptFontFamilyDisplayLabel,
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
    writeStoredTranscriptFontFamily(transcriptFontFamily);
  }, [transcriptFontFamily]);

  useEffect(() => {
    writeStoredTranscriptFontWeight(transcriptFontWeight);
  }, [transcriptFontWeight]);

  useEffect(() => {
    writeStoredTranscriptFontItalic(transcriptFontItalic);
  }, [transcriptFontItalic]);

  return {
    fontOptions,
    fontDisplayLabels,
    transcriptFontFamily,
    setTranscriptFontFamily,
    fontLoadBusy,
    transcriptFontWeight,
    setTranscriptFontWeight,
    transcriptFontItalic,
    setTranscriptFontItalic,
    transcriptFontControlDisabled,
    loadSystemFonts,
    normalizeFontFamily,
  };
}

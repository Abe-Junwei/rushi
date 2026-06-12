import { useMemo } from "react";
import { transcriptFontFamilyCssStack } from "../editor/editorTranscriptAppearance";

export function useSegmentRowTextStyle(
  transcriptFontPx: number,
  transcriptFontFamily: string,
  transcriptFontWeight: 500 | 700,
  transcriptFontItalic: boolean,
) {
  return useMemo(
    () =>
      ({
        fontSize: transcriptFontPx,
        lineHeight: 1.72,
        letterSpacing: "0.005em",
        fontWeight: transcriptFontWeight,
        fontStyle: transcriptFontItalic ? "italic" : "normal",
        fontFamily: transcriptFontFamilyCssStack(transcriptFontFamily),
      }) as const,
    [transcriptFontFamily, transcriptFontItalic, transcriptFontPx, transcriptFontWeight],
  );
}

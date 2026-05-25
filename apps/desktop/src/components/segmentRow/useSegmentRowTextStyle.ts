import { useMemo } from "react";

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
        fontFamily: `"${transcriptFontFamily}", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", Inter, system-ui, sans-serif`,
      }) as const,
    [transcriptFontFamily, transcriptFontItalic, transcriptFontPx, transcriptFontWeight],
  );
}

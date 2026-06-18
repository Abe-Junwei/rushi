import { useMemo } from "react";
import { transcriptFontFamilyCssStack } from "../editor/editorTranscriptAppearance";
import type { CspLayoutRules } from "../../utils/cspElementLayout";

export type SegmentRowTextStyle = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: string;
  fontWeight: 500 | 700;
  fontStyle: "normal" | "italic";
  fontFamily: string;
};

export function useSegmentRowTextStyle(
  transcriptFontPx: number,
  transcriptFontFamily: string,
  transcriptFontWeight: 500 | 700,
  transcriptFontItalic: boolean,
): SegmentRowTextStyle {
  return useMemo(
    () => ({
      fontSize: transcriptFontPx,
      lineHeight: 1.72,
      letterSpacing: "0.005em",
      fontWeight: transcriptFontWeight,
      fontStyle: transcriptFontItalic ? "italic" : "normal",
      fontFamily: transcriptFontFamilyCssStack(transcriptFontFamily),
    }),
    [transcriptFontFamily, transcriptFontItalic, transcriptFontPx, transcriptFontWeight],
  );
}

/** Map transcript typography to CSS vars consumed by workspace.css (Release-safe fallbacks). */
export function segmentTextAreaLayoutVars(
  textStyle: SegmentRowTextStyle,
  textAreaMinHeight: number,
  selected: boolean,
): CspLayoutRules {
  return {
    "--seg-text-font-size": `${textStyle.fontSize}px`,
    "--seg-text-line-height": String(textStyle.lineHeight),
    "--seg-text-letter-spacing": textStyle.letterSpacing,
    "--seg-text-font-weight": textStyle.fontWeight,
    "--seg-text-font-style": textStyle.fontStyle,
    "--seg-text-font-family": textStyle.fontFamily,
    "--seg-text-min-height": `${textAreaMinHeight}px`,
    ...(selected ? {} : { "--seg-text-max-height": `${textAreaMinHeight}px` }),
  };
}

import type { CspLayoutRules } from "../../utils/cspElementLayout";

export type SegmentRowTextStyle = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: string;
  fontWeight: 500 | 700;
  fontStyle: "normal" | "italic";
  fontFamily: string;
};

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

/** 镜像层内文：与 textarea / seg-text-layout-scope 同一套排版（含加粗 700）。 */
export function segmentTextTypographyLayout(textStyle: SegmentRowTextStyle): CspLayoutRules {
  return {
    fontSize: textStyle.fontSize,
    lineHeight: textStyle.lineHeight,
    letterSpacing: textStyle.letterSpacing,
    fontWeight: textStyle.fontWeight,
    fontStyle: textStyle.fontStyle,
    fontFamily: textStyle.fontFamily,
  };
}

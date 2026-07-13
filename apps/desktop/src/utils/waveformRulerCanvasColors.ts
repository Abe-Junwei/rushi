import { readCssColorVar, resolveCssColorExpression } from "./waveformThemeColors";

export type WaveformRulerCanvasPalette = {
  minorTick: string;
  majorTick: string;
  label: string;
  labelActive: string;
};

function notionTextCanvasColor(pct: number, alphaFallback: number): string {
  const base = readCssColorVar("--notion-text", "#37352f");
  const [r, g, b] =
    base.startsWith("#") && base.length >= 7
      ? [
          Number.parseInt(base.slice(1, 3), 16),
          Number.parseInt(base.slice(3, 5), 16),
          Number.parseInt(base.slice(5, 7), 16),
        ]
      : [55, 53, 47];
  const fallback = `rgba(${r}, ${g}, ${b}, ${alphaFallback})`;
  const resolved = resolveCssColorExpression(
    `color-mix(in srgb, var(--notion-text) ${pct}%, transparent)`,
    fallback,
    "backgroundColor",
  );
  if (!resolved || resolved === "transparent" || resolved === "rgba(0, 0, 0, 0)") {
    return fallback;
  }
  return resolved;
}

/** Canvas tick/label colors — aligned with former WaveformTimeRulerTickLayer token opacities. */
export function readWaveformRulerCanvasPalette(
  palette: WaveformRulerCanvasPalette = defaultWaveformRulerCanvasPalette(),
): WaveformRulerCanvasPalette {
  return palette;
}

export function defaultWaveformRulerCanvasPalette(): WaveformRulerCanvasPalette {
  return {
    minorTick: notionTextCanvasColor(38, 0.38),
    majorTick: notionTextCanvasColor(62, 0.62),
    label: notionTextCanvasColor(72, 0.72),
    labelActive: notionTextCanvasColor(90, 0.9),
  };
}

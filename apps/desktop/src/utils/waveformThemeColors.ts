import { COLORS } from "../config/tokens";

let colorProbeEl: HTMLDivElement | null = null;

function getColorProbe(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (!colorProbeEl) {
    colorProbeEl = document.createElement("div");
    colorProbeEl.setAttribute("aria-hidden", "true");
    colorProbeEl.style.position = "absolute";
    colorProbeEl.style.pointerEvents = "none";
    colorProbeEl.style.opacity = "0";
    colorProbeEl.style.width = "0";
    colorProbeEl.style.height = "0";
    document.documentElement.appendChild(colorProbeEl);
  }
  return colorProbeEl;
}

/** 读取 `:root` 上的 CSS 变量；空值时回退。 */
export function readCssColorVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * 将含 `var()` / `color-mix()` 的表达式解析为浏览器可绘制的 `rgb(a)`。
 * Canvas 2D 与 WaveSurfer 无法直接使用 color-mix 字符串。
 */
export function resolveCssColorExpression(
  expression: string,
  fallback: string,
  property: "backgroundColor" | "color" = "backgroundColor",
): string {
  if (typeof document === "undefined") return fallback;
  const probe = getColorProbe();
  if (!probe) return fallback;
  probe.style[property] = expression;
  const resolved = getComputedStyle(probe)[property].trim();
  probe.style[property] = "";
  if (!resolved || resolved === "rgba(0, 0, 0, 0)" && expression.includes("transparent") === false) {
    return fallback;
  }
  return resolved;
}

export type WaveformSurferPalette = {
  waveColor: string;
  progressColor: string;
  cursorColor: string;
};

/** WaveSurfer peaks 配色 — 对齐 tokens.css `--zen-wf-*`。 */
export function readWaveformSurferPalette(): WaveformSurferPalette {
  const waveColor = readCssColorVar("--zen-wf-wave", COLORS.waveformWave);
  const progressColor = resolveCssColorExpression(
    "color-mix(in srgb, var(--zen-saffron-mid) 22%, var(--zen-wf-progress))",
    COLORS.waveformProgressPlayed,
  );
  const cursorColor = readCssColorVar("--zen-wf-cursor", COLORS.waveformCursor);
  return { waveColor, progressColor, cursorColor };
}

export type WaveformSegmentBandPalette = {
  selected: string;
  lowConfidence: string;
  visited: string;
  idle: string;
  border: string;
};

/** 语段 band canvas 配色 — 与 segmentChrome / tokens 语义对齐。 */
export function readWaveformSegmentBandPalette(): WaveformSegmentBandPalette {
  return {
    selected: resolveCssColorExpression(
      "color-mix(in srgb, var(--accent-edit) 26%, transparent)",
      "rgba(61, 79, 93, 0.26)",
    ),
    lowConfidence: resolveCssColorExpression(
      "color-mix(in srgb, var(--notion-text-light) 24%, transparent)",
      "rgba(156, 163, 175, 0.24)",
    ),
    visited: resolveCssColorExpression(
      "color-mix(in srgb, var(--zen-saffron-mid) 13%, transparent)",
      "rgba(133, 83, 15, 0.13)",
    ),
    idle: resolveCssColorExpression(
      "color-mix(in srgb, var(--zen-ink) 11%, transparent)",
      "rgba(44, 44, 44, 0.11)",
    ),
    border: resolveCssColorExpression(
      "color-mix(in srgb, var(--notion-text) 14%, transparent)",
      "rgba(55, 53, 47, 0.14)",
    ),
  };
}

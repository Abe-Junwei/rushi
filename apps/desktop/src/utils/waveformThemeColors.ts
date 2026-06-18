import { COLORS } from "../config/tokens";
import { SEGMENT_FILL_CSS_VAR } from "../config/segmentFillTokens";
import { clearCspLayoutRules, setCspLayoutRules } from "./cspElementLayout";

let colorProbeEl: HTMLDivElement | null = null;

function getColorProbe(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (!colorProbeEl) {
    colorProbeEl = document.createElement("div");
    colorProbeEl.setAttribute("aria-hidden", "true");
    colorProbeEl.className = "waveform-color-probe";
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
  setCspLayoutRules(probe, { [property]: expression });
  const resolved = getComputedStyle(probe)[property].trim();
  clearCspLayoutRules(probe);
  if (!resolved || (resolved === "rgba(0, 0, 0, 0)" && expression.includes("transparent") === false)) {
    return fallback;
  }
  return resolved;
}

export type WaveformSurferPalette = {
  waveColor: string;
  progressColor: string;
  cursorColor: string;
};

/** 读取 tokens.css 中 color-mix 表达式并解析为 canvas 可用的 rgb(a)。 */
function resolveRootFillToken(
  cssVarName: string,
  fallbackExpression: string,
  fallbackRgb: string,
): string {
  const expression = readCssColorVar(cssVarName, fallbackExpression);
  return resolveCssColorExpression(expression, fallbackRgb);
}

/** WaveSurfer peaks 配色 — 对齐 tokens.css `--zen-wf-*`。 */
export function readWaveformSurferPalette(): WaveformSurferPalette {
  const waveColor = readCssColorVar("--zen-wf-wave", COLORS.waveformWave);
  const progressColor = resolveRootFillToken(
    "--zen-wf-progress-played",
    "color-mix(in srgb, var(--accent-action-strong) 32%, var(--zen-wf-progress))",
    COLORS.waveformProgressPlayed,
  );
  const cursorColor = readCssColorVar("--zen-wf-cursor", COLORS.waveformCursor);
  return { waveColor, progressColor, cursorColor };
}

export type WaveformSegmentBandPalette = {
  selected: string;
  inSelection: string;
  lowConfidence: string;
  visited: string;
  idle: string;
  border: string;
};

/** 语段 band canvas 配色 — 与 segmentChrome / tokens.css `--segment-fill-*` 同源。 */
export function readWaveformSegmentBandPalette(): WaveformSegmentBandPalette {
  return {
    selected: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.selected,
      "color-mix(in srgb, var(--accent-action) 26%, transparent)",
      "rgba(197, 138, 67, 0.26)",
    ),
    inSelection: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.inSelectionWaveform,
      "color-mix(in srgb, var(--accent-action) 12%, transparent)",
      "rgba(197, 138, 67, 0.12)",
    ),
    lowConfidence: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.lowConfidence,
      "color-mix(in srgb, var(--notion-text-light) 24%, transparent)",
      "rgba(156, 163, 175, 0.24)",
    ),
    visited: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.visited,
      "color-mix(in srgb, var(--accent-action-strong) 18%, transparent)",
      "rgba(133, 83, 15, 0.18)",
    ),
    idle: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.idle,
      "color-mix(in srgb, var(--zen-ink) 11%, transparent)",
      "rgba(44, 44, 44, 0.11)",
    ),
    border: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.border,
      "color-mix(in srgb, var(--notion-text) 14%, transparent)",
      "rgba(55, 53, 47, 0.14)",
    ),
  };
}

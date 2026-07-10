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

function readAccentActionHex(fallback = "#C58A43"): string {
  return readCssColorVar("--accent-action", fallback);
}

function readAccentActionStrongHex(fallback = "#85530f"): string {
  return readCssColorVar("--accent-action-strong", fallback);
}

/** Canvas fallback — 随当前 accent 解析，避免 Office 主题下仍回退 saffron。 */
function accentMixFallback(actionPct: number, alphaFallback: number): string {
  const accent = readAccentActionHex();
  const expression = `color-mix(in srgb, ${accent} ${actionPct}%, transparent)`;
  const [r, g, b] = hexToRgb(accent) ?? [197, 138, 67];
  return resolveCssColorExpression(expression, `rgba(${r}, ${g}, ${b}, ${alphaFallback})`);
}

function accentStrongMixFallback(strongPct: number, alphaFallback: number): string {
  const strong = readAccentActionStrongHex();
  const expression = `color-mix(in srgb, ${strong} ${strongPct}%, transparent)`;
  const [r, g, b] = hexToRgb(strong) ?? [133, 83, 15];
  return resolveCssColorExpression(expression, `rgba(${r}, ${g}, ${b}, ${alphaFallback})`);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    return [r, g, b];
  }
  if (normalized.length !== 6) return null;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
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
  const unresolved =
    !resolved ||
    resolved.includes("color-mix(") ||
    resolved.includes("var(") ||
    (resolved === "rgba(0, 0, 0, 0)" && expression.includes("transparent") === false);
  if (unresolved) {
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

/** WaveSurfer peaks 配色 — 对齐 tokens.css `--zen-wf-*`（已播放为中性淡化，不锁 accent）。 */
export function readWaveformSurferPalette(): WaveformSurferPalette {
  const waveColor = readCssColorVar("--zen-wf-wave", COLORS.waveformWave);
  const progressColor = readCssColorVar(
    "--zen-wf-progress-played",
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
  selectedBorder: string;
  inSelectionBorder: string;
};

/** 语段 band canvas 配色 — 与 segmentChrome / tokens.css `--segment-fill-*` 同源。 */
let cachedSegmentBandPalette: WaveformSegmentBandPalette | null = null;

export function invalidateWaveformSegmentBandPaletteCache(): void {
  cachedSegmentBandPalette = null;
}

export function readWaveformSegmentBandPalette(): WaveformSegmentBandPalette {
  if (cachedSegmentBandPalette) return cachedSegmentBandPalette;
  cachedSegmentBandPalette = {
    selected: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.selected,
      "color-mix(in srgb, var(--accent-action) 14%, transparent)",
      accentMixFallback(14, 0.14),
    ),
    inSelection: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.inSelectionWaveform,
      "color-mix(in srgb, var(--accent-action) 8%, transparent)",
      accentMixFallback(8, 0.08),
    ),
    lowConfidence: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.lowConfidence,
      "color-mix(in srgb, var(--notion-text-light) 10%, transparent)",
      "rgba(156, 163, 175, 0.10)",
    ),
    visited: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.visited,
      "color-mix(in srgb, var(--notion-text) 10%, transparent)",
      "rgba(55, 53, 47, 0.10)",
    ),
    idle: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.idle,
      "color-mix(in srgb, var(--notion-text) 5%, transparent)",
      "rgba(55, 53, 47, 0.05)",
    ),
    border: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.border,
      "color-mix(in srgb, var(--notion-text) 24%, transparent)",
      "rgba(55, 53, 47, 0.24)",
    ),
    selectedBorder: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.selectedBorder,
      "color-mix(in srgb, var(--accent-action-strong) 48%, transparent)",
      accentStrongMixFallback(48, 0.48),
    ),
    inSelectionBorder: resolveRootFillToken(
      SEGMENT_FILL_CSS_VAR.inSelectionBorder,
      "color-mix(in srgb, var(--accent-action) 34%, transparent)",
      accentMixFallback(34, 0.34),
    ),
  };
  return cachedSegmentBandPalette;
}

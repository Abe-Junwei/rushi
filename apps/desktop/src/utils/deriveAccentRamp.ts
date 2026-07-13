/**
 * Derive Office accent token ramp from a single base hex (Obsidian-style free accent).
 * Research: docs/execution/specs/obsidian-style-accent-color-research.md
 */

import { BRAND_OFFICE_ACCENT } from "../config/officeAccentThemes";

export type AccentRamp = {
  base: string;
  mid: string;
  deep: string;
  light: string;
  surface: string;
  border: string;
  /** Obsidian-aligned HSL components (hue 0–360, s/l 0–100). */
  accentH: number;
  accentS: number;
  accentL: number;
};

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function normalizeAccentHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) return null;
  const raw = trimmed.slice(1);
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return `#${full.toLowerCase()}`;
}

export function isBrandAccentHex(hex: string): boolean {
  const n = normalizeAccentHex(hex);
  return n != null && n === normalizeAccentHex(BRAND_OFFICE_ACCENT.base);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channelsToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.round(clamp01(v / 255) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rn:
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      break;
    case gn:
      h = ((bn - rn) / d + 2) / 6;
      break;
    default:
      h = ((rn - gn) / d + 4) / 6;
      break;
  }
  return { h: h * 360, s, l };
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = clamp01(s);
  const ll = clamp01(l);
  if (ss === 0) {
    const v = ll * 255;
    return { r: v, g: v, b: v };
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  return {
    r: hue2rgb(p, q, hh + 1 / 3) * 255,
    g: hue2rgb(p, q, hh) * 255,
    b: hue2rgb(p, q, hh - 1 / 3) * 255,
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return channelsToHex(r, g, b);
}

function rampFromBrandConstants(): AccentRamp {
  const brandBase = normalizeAccentHex(BRAND_OFFICE_ACCENT.base) ?? "#c58a43";
  const { r, g, b } = hexToRgb(brandBase);
  const { h, s, l } = rgbToHsl(r, g, b);
  return {
    base: brandBase,
    mid: normalizeAccentHex(BRAND_OFFICE_ACCENT.mid) ?? BRAND_OFFICE_ACCENT.mid.toLowerCase(),
    deep: normalizeAccentHex(BRAND_OFFICE_ACCENT.deep) ?? BRAND_OFFICE_ACCENT.deep.toLowerCase(),
    light: normalizeAccentHex(BRAND_OFFICE_ACCENT.light) ?? BRAND_OFFICE_ACCENT.light.toLowerCase(),
    surface:
      normalizeAccentHex(BRAND_OFFICE_ACCENT.surface) ?? BRAND_OFFICE_ACCENT.surface.toLowerCase(),
    border: normalizeAccentHex(BRAND_OFFICE_ACCENT.border) ?? BRAND_OFFICE_ACCENT.border.toLowerCase(),
    accentH: Math.round(h),
    accentS: Math.round(s * 100),
    accentL: Math.round(l * 100),
  };
}

/** Derive mid/deep/tints from base; invalid input → brand ramp constants. */
export function deriveAccentRamp(inputHex: string): AccentRamp {
  const normalized = normalizeAccentHex(inputHex);
  if (!normalized) {
    return rampFromBrandConstants();
  }
  const { r, g, b } = hexToRgb(normalized);
  const { h, s, l } = rgbToHsl(r, g, b);
  const midL = clamp01(l * 0.62);
  const deepL = clamp01(l * 0.38);
  const lightL = clamp01(Math.max(0.88, l + (1 - l) * 0.75));
  const lightS = clamp01(s * 0.55);
  const surfaceL = clamp01(Math.max(0.94, l + (1 - l) * 0.85));
  const surfaceS = clamp01(s * 0.35);
  const borderL = clamp01(Math.max(0.82, l + (1 - l) * 0.55));
  const borderS = clamp01(s * 0.45);

  return {
    base: normalized,
    mid: hslToHex(h, s, midL),
    deep: hslToHex(h, s, deepL),
    light: hslToHex(h, lightS, lightL),
    surface: hslToHex(h, surfaceS, surfaceL),
    border: hslToHex(h, borderS, borderL),
    accentH: Math.round(h),
    accentS: Math.round(s * 100),
    accentL: Math.round(l * 100),
  };
}

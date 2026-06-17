import { describe, expect, it } from "vitest";
import { COLORS } from "./tokens";

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((c) => c + c).join("")
    : normalized;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("primary action contrast", () => {
  it("hover: white on saffron-mid meets WCAG AA 4.5:1", () => {
    const ratio = contrastRatio(COLORS.primaryActionFgHover, COLORS.primaryActionBgHover);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("resting: white on saffron is product default (~3:1, below AA for 12px body)", () => {
    const ratio = contrastRatio(COLORS.primaryActionFg, COLORS.primaryActionBg);
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeGreaterThan(2.5);
  });
});

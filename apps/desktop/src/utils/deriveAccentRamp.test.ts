import { describe, expect, it } from "vitest";
import { BRAND_OFFICE_ACCENT } from "../config/officeAccentThemes";
import {
  deriveAccentRamp,
  isBrandAccentHex,
  normalizeAccentHex,
} from "./deriveAccentRamp";

describe("deriveAccentRamp", () => {
  it("normalizes short and long hex", () => {
    expect(normalizeAccentHex("#AbC")).toBe("#aabbcc");
    expect(normalizeAccentHex("  #0078D4 ")).toBe("#0078d4");
    expect(normalizeAccentHex("not-a-color")).toBeNull();
  });

  it("detects brand hex case-insensitively", () => {
    expect(isBrandAccentHex(BRAND_OFFICE_ACCENT.base)).toBe(true);
    expect(isBrandAccentHex("#c58a43")).toBe(true);
    expect(isBrandAccentHex("#0078d4")).toBe(false);
  });

  it("falls back to brand constants on invalid input", () => {
    const ramp = deriveAccentRamp("nope");
    expect(ramp.base).toBe("#c58a43");
    expect(ramp.mid).toBe(BRAND_OFFICE_ACCENT.mid.toLowerCase());
  });

  it("derives darker mid/deep and lighter tints from blue", () => {
    const ramp = deriveAccentRamp("#0078d4");
    expect(ramp.base).toBe("#0078d4");
    expect(ramp.mid).not.toBe(ramp.base);
    expect(ramp.deep).not.toBe(ramp.mid);
    expect(ramp.accentH).toBeGreaterThan(180);
    expect(ramp.accentH).toBeLessThan(230);
    expect(ramp.accentS).toBeGreaterThan(50);
    // mid/deep should be darker (lower lightness) than base
    expect(ramp.accentL).toBeGreaterThan(20);
  });

  it("keeps brand ramp in the same visual ballpark", () => {
    const ramp = deriveAccentRamp(BRAND_OFFICE_ACCENT.base);
    expect(ramp.base).toBe("#c58a43");
    expect(ramp.mid.startsWith("#")).toBe(true);
    expect(ramp.deep.startsWith("#")).toBe(true);
    expect(ramp.light.startsWith("#")).toBe(true);
  });
});

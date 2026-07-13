import { describe, expect, it } from "vitest";
import {
  OFFICE_ACCENT_THEME_PRESETS,
  resolveAccentHexFromLegacyId,
} from "./officeAccentThemes";

describe("officeAccentThemes", () => {
  it("exposes brand plus eight accent color presets for legacy migration", () => {
    expect(OFFICE_ACCENT_THEME_PRESETS).toHaveLength(9);
    expect(OFFICE_ACCENT_THEME_PRESETS.map((preset) => preset.id)).toEqual([
      "brand",
      "blue",
      "red",
      "orange",
      "green",
      "indigo",
      "pink",
      "teal",
      "gray",
    ]);
  });

  it("resolves legacy preset ids to base hex", () => {
    expect(resolveAccentHexFromLegacyId("blue")).toBe("#0078D4");
    expect(resolveAccentHexFromLegacyId("purple")).toBe("#3D4F5D");
    expect(resolveAccentHexFromLegacyId("unknown")).toBe("#C58A43");
  });
});

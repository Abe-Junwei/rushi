import { describe, expect, it } from "vitest";
import { buildExportPolishGlossaryHints } from "./exportPolishGlossaryHints";
import type { GlossaryTermDto } from "../tauri/glossaryApi";

function term(t: string): GlossaryTermDto {
  return {
    id: 0,
    term: t,
    aliases: "",
    domain: "",
    note: "",
    created_at_ms: 0,
    updated_at_ms: 0,
    hotword_enabled: true,
  };
}

describe("buildExportPolishGlossaryHints", () => {
  it("returns empty string when no terms", () => {
    expect(buildExportPolishGlossaryHints([])).toBe("");
  });

  it("filters blank terms and sorts, dedupes remaining", () => {
    const hints = buildExportPolishGlossaryHints([
      term("术语乙"),
      term(""),
      term("术语甲"),
      term("术语甲"),
      term("  "),
    ]);
    expect(hints).toBe("- 术语乙\n- 术语甲");
  });

  it("caps at 200 terms", () => {
    const terms = Array.from({ length: 210 }, (_, i) => term(`词${String(i).padStart(4, "0")}`));
    const hints = buildExportPolishGlossaryHints(terms);
    expect(hints.split("\n")).toHaveLength(200);
  });
});

import { describe, expect, it } from "vitest";
import { filterCorrectSuggestions } from "./correctSuggestions";

describe("filterCorrectSuggestions", () => {
  it("matches glossary term literally only", () => {
    const items = filterCorrectSuggestions(
      "觉观",
      [],
      [{ id: 1, term: "觉观", aliases: "", domain: "", note: "", created_at_ms: 0, updated_at_ms: 0, hotword_enabled: true }],
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("glossary");
  });

  it("matches correction rule by wrong substring", () => {
    const items = filterCorrectSuggestions(
      "波那",
      [{ wrong: "安波那那", right: "安那般那", hitCount: 3, acceptedAsRule: false }],
      [],
    );
    expect(items.some((x) => x.kind === "rule")).toBe(true);
  });
});

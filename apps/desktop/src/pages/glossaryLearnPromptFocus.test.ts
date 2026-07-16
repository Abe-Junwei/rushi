import { describe, expect, it } from "vitest";
import { filterGlossaryLearnPromptsForFocus } from "./glossaryLearnPromptFocus";

describe("filterGlossaryLearnPromptsForFocus", () => {
  const rows = [
    { afterText: "香板", hitCount: 7, sampleBefore: "乡版" },
    { afterText: "提持", hitCount: 5, sampleBefore: "提尺" },
    { afterText: "制控", hitCount: 3, sampleBefore: "智控" },
  ];

  it("returns empty when focus list is empty", () => {
    expect(filterGlossaryLearnPromptsForFocus(rows, [])).toEqual([]);
  });

  it("keeps only the just-learned afterText", () => {
    expect(filterGlossaryLearnPromptsForFocus(rows, ["制控"])).toEqual([
      { afterText: "制控", hitCount: 3, sampleBefore: "智控" },
    ]);
  });

  it("does not resurface unrelated backlog terms", () => {
    expect(filterGlossaryLearnPromptsForFocus(rows, ["制控"]).map((r) => r.afterText)).toEqual([
      "制控",
    ]);
  });
});

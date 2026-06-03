import { describe, expect, it, vi, beforeEach } from "vitest";
import { formatPromoteToGlossaryToast, promoteAfterTextsToGlossary } from "./promoteLearnPairToGlossary";

vi.mock("../tauri/glossaryApi", () => ({
  glossaryAdd: vi.fn(),
}));

import { glossaryAdd } from "../tauri/glossaryApi";

describe("promoteAfterTextsToGlossary", () => {
  beforeEach(() => {
    vi.mocked(glossaryAdd).mockReset();
  });

  it("adds unique after texts with empty aliases and hotword enabled", async () => {
    vi.mocked(glossaryAdd).mockResolvedValue({
      id: 1,
      term: "胸膺",
      aliases: "",
      domain: "",
      note: "",
      created_at_ms: 1,
      updated_at_ms: 1,
      hotword_enabled: true,
    });
    const result = await promoteAfterTextsToGlossary(["胸膺", "胸膺"]);
    expect(glossaryAdd).toHaveBeenCalledTimes(1);
    expect(glossaryAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        term: "胸膺",
        aliases: "",
        hotwordEnabled: true,
      }),
    );
    expect(result.added).toEqual(["胸膺"]);
  });

  it("treats duplicate term error as already in glossary", async () => {
    vi.mocked(glossaryAdd).mockRejectedValue(new Error("该术语已存在（忽略大小写）"));
    const result = await promoteAfterTextsToGlossary(["制控"]);
    expect(result.alreadyInGlossary).toEqual(["制控"]);
    expect(result.added).toEqual([]);
  });
});

describe("formatPromoteToGlossaryToast", () => {
  it("formats single add", () => {
    expect(formatPromoteToGlossaryToast({ added: ["胸膺"], alreadyInGlossary: [], failed: [] })).toContain(
      "胸膺",
    );
  });
});

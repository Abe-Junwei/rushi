import { describe, expect, it } from "vitest";
import type { CorrectionMemoryEntryRow } from "../tauri/correctionApi";
import type { GlossaryTermDto } from "../tauri/glossaryApi";
import { sortCorrectionMemoryRows, sortGlossaryTerms } from "./glossaryListSort";

function term(id: number, t: string, updated = id): GlossaryTermDto {
  return {
    id,
    term: t,
    aliases: "",
    domain: "",
    note: "",
    hotword_enabled: true,
    created_at_ms: updated,
    updated_at_ms: updated,
  };
}

function mem(wrong: string, right: string, updated = 1): CorrectionMemoryEntryRow {
  return {
    wrong,
    right,
    hitCount: 1,
    isStable: false,
    acceptedAsRule: false,
    updatedAtMs: updated,
  };
}

describe("glossaryListSort", () => {
  it("sortGlossaryTerms pinyin-asc orders by main term (ICU zh pinyin)", () => {
    const rows = [term(1, "制控"), term(2, "上座"), term(3, "午禅")];
    const out = sortGlossaryTerms(rows, "pinyin-asc").map((r) => r.term);
    expect(out).toEqual(["上座", "午禅", "制控"]);
  });

  it("sortGlossaryTerms pinyin-desc reverses pinyin order", () => {
    const rows = [term(1, "制控"), term(2, "上座"), term(3, "午禅")];
    const out = sortGlossaryTerms(rows, "pinyin-desc").map((r) => r.term);
    expect(out).toEqual(["制控", "午禅", "上座"]);
  });

  it("sortCorrectionMemoryRows pinyin-asc orders by wrong word", () => {
    const rows = [mem("制控", "智控"), mem("上座", "让座"), mem("午禅", "吴禅")];
    const out = sortCorrectionMemoryRows(rows, "pinyin-asc").map((r) => r.wrong);
    expect(out).toEqual(["上座", "午禅", "制控"]);
  });
});

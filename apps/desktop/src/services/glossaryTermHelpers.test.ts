import { describe, expect, it } from "vitest";
import {
  applyGlossaryFilters,
  batchHotwordMessage,
  batchResultMessage,
  buildGlossaryCsvExport,
  type GlossaryEditorDraft,
  glossaryDraftHasTerm,
} from "./glossaryTermHelpers";
import type { GlossaryTermDto } from "../tauri/glossaryApi";

const sample: GlossaryTermDto[] = [
  {
    id: 1,
    term: "三乘",
    aliases: "主任",
    domain: "佛学",
    note: "ASR 热词",
    created_at_ms: 100,
    updated_at_ms: 200,
    hotword_enabled: true,
  },
  {
    id: 2,
    term: "学记",
    aliases: "",
    domain: "典籍",
    note: "",
    created_at_ms: 300,
    updated_at_ms: 300,
    hotword_enabled: false,
  },
];

describe("glossaryTermHelpers", () => {
  it("filters by term, alias, domain, note", () => {
    expect(applyGlossaryFilters(sample, "主任", "all")).toHaveLength(1);
    expect(applyGlossaryFilters(sample, "典籍", "all")).toHaveLength(1);
    expect(applyGlossaryFilters(sample, "", "enabled")).toHaveLength(1);
    expect(applyGlossaryFilters(sample, "", "disabled")).toHaveLength(1);
  });

  it("escapes csv fields with commas", () => {
    const csv = buildGlossaryCsvExport([
      {
        id: 3,
        term: "foo,bar",
        aliases: "",
        domain: "",
        note: 'say "hi"',
        created_at_ms: 1,
        updated_at_ms: 2,
        hotword_enabled: true,
      },
    ]);
    expect(csv).toContain('"foo,bar"');
    expect(csv).toContain('"say ""hi"""');
  });

  it("requires primary term in draft", () => {
    const empty: GlossaryEditorDraft = { term: "", aliases: "x", domain: "", note: "", hotwordEnabled: true };
    expect(glossaryDraftHasTerm(empty)).toBe(false);
  });

  it("formats batch result mismatch", () => {
    expect(batchResultMessage("已删除", 3, 2)).toContain("2/3");
    expect(batchHotwordMessage(true, 5, 5)).toContain("纳入热词");
  });
});

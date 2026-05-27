import { describe, expect, it } from "vitest";
import { splitGlossaryPasteInput } from "./glossaryPasteSplit";

describe("splitGlossaryPasteInput", () => {
  it("splits excel tsv grid (tab columns, newline rows)", () => {
    expect(splitGlossaryPasteInput("三乘\t主任\n今天\t有学")).toEqual([
      "三乘",
      "主任",
      "今天",
      "有学",
    ]);
  });

  it("splits newlines and chinese punctuation", () => {
    expect(splitGlossaryPasteInput("三乘\n主任\n今天")).toEqual(["三乘", "主任", "今天"]);
    expect(splitGlossaryPasteInput("《六祖坛经》，《学记》")).toEqual(["《六祖坛经》", "《学记》"]);
  });

  it("strips quoted csv cells from excel export", () => {
    expect(splitGlossaryPasteInput('"foo"\t"bar"\n')).toEqual(["foo", "bar"]);
  });

  it("dedupes case-insensitively within one paste", () => {
    expect(splitGlossaryPasteInput("Foo\nfoo")).toEqual(["Foo"]);
  });

  it("returns single term when no delimiter", () => {
    expect(splitGlossaryPasteInput("  有学  ")).toEqual(["有学"]);
  });

  it("normalizes excel nbsp and bom", () => {
    expect(splitGlossaryPasteInput("\uFEFFa\tb\u00A0")).toEqual(["a", "b"]);
  });
});

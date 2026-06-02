import { describe, expect, it } from "vitest";
import {
  describeLexiconOpsForPreview,
  parseRuleEvidenceRef,
  rulePairsFromLexiconItems,
} from "./postprocessLexiconOps";
import type { RefineSegmentItem } from "../../tauri/postprocessApi";

const window: RefineSegmentItem[] = [
  { uid: "a", startSec: 0, endSec: 1, text: "安波那那" },
];

describe("postprocessLexiconOps", () => {
  it("describes preview with evidence", () => {
    const labels = describeLexiconOpsForPreview(window, [
      {
        uid: "a",
        text: "安那般那",
        evidence: { type: "rule", ref: "安波那那→安那般那" },
      },
    ]);
    expect(labels[0]).toContain("纠错记忆");
    expect(labels[0]).toContain("安波那那→安那般那");
  });

  it("parses rule pairs for accept", () => {
    expect(parseRuleEvidenceRef("x->y")).toEqual({ before: "x", after: "y" });
    const pairs = rulePairsFromLexiconItems([
      {
        uid: "a",
        text: "y",
        evidence: { type: "rule", ref: "x→y" },
      },
      {
        uid: "b",
        text: "t",
        evidence: { type: "glossary", ref: "术语" },
      },
    ]);
    expect(pairs).toEqual([{ before: "x", after: "y" }]);
  });
});

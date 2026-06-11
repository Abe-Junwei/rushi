import { describe, expect, it } from "vitest";
import {
  formatLexiconBundleExportCleanupHints,
  formatLexiconBundleExportPreviewSummary,
  type LexiconBundleExportPreview,
} from "./lexiconBundleApi";

const basePreview: LexiconBundleExportPreview = {
  glossaryCount: 4,
  rulesExportCount: 2,
  rulesAllDedupedCount: 5,
  excludedHit1Unaccepted: 1,
  excludedLearningUnaccepted: 2,
  duplicateBeforeGroupCount: 1,
  duplicateBeforeSamples: ["闪法"],
};

describe("formatLexiconBundleExportPreviewSummary", () => {
  it("summarizes stable export counts", () => {
    expect(formatLexiconBundleExportPreviewSummary(basePreview, true)).toBe(
      "术语 4 条；纠错规则 2 条（将写入词表包）；全量去重后共 5 条",
    );
  });

  it("omits all-deduped note when exporting everything", () => {
    expect(formatLexiconBundleExportPreviewSummary(basePreview, false)).toBe(
      "术语 4 条；纠错规则 2 条（将写入词表包）",
    );
  });
});

describe("formatLexiconBundleExportCleanupHints", () => {
  it("lists stable-only exclusions and duplicate-before warnings", () => {
    expect(formatLexiconBundleExportCleanupHints(basePreview, true)).toEqual([
      "1 条仅命中 1 次且未采纳，勾选「仅稳定记忆」时将不导出",
      "2 条学习中（命中 2 次），勾选「仅稳定记忆」时将不导出",
      "1 组同错形对应多个正形（如 闪法），导出时会保留命中更高的一条，建议在记忆库先合并",
    ]);
  });
});

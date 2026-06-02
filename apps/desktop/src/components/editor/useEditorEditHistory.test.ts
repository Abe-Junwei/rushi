import { describe, expect, it } from "vitest";
import {
  formatHistorySubLines,
  parseEditLogDetail,
  summarizeHistoryHeadline,
} from "./useEditorEditHistory";

describe("useEditorEditHistory", () => {
  it("parses text_changes and builds headline", () => {
    const detail = JSON.stringify({
      op: "save_segments",
      count: 177,
      summary: "语段 46：「肩背胸襟向两臂」→「肩背胸膺向两臂」",
      text_changes: [
        {
          segment_idx: 45,
          uid: "u1",
          before: "肩背胸襟向两臂",
          after: "肩背胸膺向两臂",
        },
      ],
    });
    const parsed = parseEditLogDetail(detail);
    expect(parsed?.text_changes).toHaveLength(1);
    expect(summarizeHistoryHeadline(detail, "save_segments")).toContain("胸膺");
    expect(formatHistorySubLines(detail)[0]).toContain("语段 46");
  });

  it("falls back for legacy detail without text_changes", () => {
    const detail = JSON.stringify({ op: "save_segments", count: 10, file_id: "abc" });
    expect(summarizeHistoryHeadline(detail, "save_segments")).toBe("保存语段（10 条语段）");
  });
});

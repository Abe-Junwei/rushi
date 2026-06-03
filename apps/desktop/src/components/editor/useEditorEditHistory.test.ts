import { describe, expect, it } from "vitest";
import {
  canRestoreEditLogRow,
  formatHistorySubLines,
  parseEditLogDetail,
  summarizeHistoryHeadline,
} from "./useEditorEditHistory";
import type { EditLogEntryDto } from "../../tauri/projectApi";

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

  it("formatHistorySubLines includes restore target summary", () => {
    const detail = JSON.stringify({
      op: "restore_from_edit_log",
      source_summary: "语段 1：「胸襟」→「胸膺」",
      text_changes: [{ segment_idx: 0, uid: "u1", before: "胸膺", after: "胸襟" }],
    });
    const lines = formatHistorySubLines(detail);
    expect(lines[0]).toContain("目标版本");
    expect(lines.some((l) => l.includes("胸膺"))).toBe(true);
  });

  it("canRestoreEditLogRow requires snapshot and matching file", () => {
    const row: EditLogEntryDto = {
      id: 1,
      project_id: "p",
      at_ms: 1,
      kind: "save_segments",
      detail: JSON.stringify({ file_id: "f1" }),
      has_snapshot: true,
    };
    expect(canRestoreEditLogRow(row, "f1", false)).toBe(true);
    expect(canRestoreEditLogRow(row, "f2", false)).toBe(false);
    expect(canRestoreEditLogRow({ ...row, has_snapshot: false }, "f1", false)).toBe(false);
    expect(canRestoreEditLogRow(row, "f1", true)).toBe(false);
    expect(
      canRestoreEditLogRow(
        {
          ...row,
          kind: "restore_from_edit_log",
          detail: JSON.stringify({ file_id: "f1" }),
        },
        "f1",
        false,
      ),
    ).toBe(true);
    expect(
      canRestoreEditLogRow({ ...row, kind: "project_import" }, "f1", false),
    ).toBe(false);
  });
});

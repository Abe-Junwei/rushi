import { describe, expect, it } from "vitest";
import { buildDeliveryExportAppendixLines, buildDocxExportMetaLine } from "./exportDeliveryAppendix";
import type { EditLogEntryDto } from "../tauri/projectApi";

describe("buildDeliveryExportAppendixLines", () => {
  it("filters by file_id and skips project_import", () => {
    const rows: EditLogEntryDto[] = [
      {
        id: 1,
        project_id: "p",
        at_ms: 1_700_000_000_000,
        kind: "save_segments",
        detail: JSON.stringify({
          file_id: "f1",
          summary: "保存 2 处",
          text_changes: [{ segment_idx: 0, uid: "u0", before: "a", after: "b" }],
        }),
        has_snapshot: true,
      },
      {
        id: 2,
        project_id: "p",
        at_ms: 1_700_000_000_100,
        kind: "save_segments",
        detail: JSON.stringify({ file_id: "f2", summary: "其他文件" }),
        has_snapshot: false,
      },
      {
        id: 3,
        project_id: "p",
        at_ms: 1_700_000_000_200,
        kind: "project_import",
        detail: "{}",
        has_snapshot: false,
      },
    ];
    const lines = buildDeliveryExportAppendixLines(rows, "f1");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.includes("保存 2 处"))).toBe(true);
    expect(lines.some((l) => l.includes("其他文件"))).toBe(false);
  });
});

describe("buildDocxExportMetaLine", () => {
  it("includes project title", () => {
    const line = buildDocxExportMetaLine("课程 A", new Date("2026-06-03T12:00:00"));
    expect(line).toContain("课程 A");
    expect(line.startsWith("导出：")).toBe(true);
  });
});

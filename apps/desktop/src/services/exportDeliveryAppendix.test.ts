import { describe, expect, it } from "vitest";
import { buildDeliveryExportAppendixLines, buildDocxExportMetaLine, listDocxProjectMetadataPreviewLines } from "./exportDeliveryAppendix";
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
  it("omits export stamp by default", () => {
    const line = buildDocxExportMetaLine("课程 A", new Date("2026-06-03T12:00:00"));
    expect(line).toBe("");
    expect(line).not.toContain("导出：");
  });

  it("appends filled session metadata only when opted in", () => {
    const metadata = {
      narrator: "张三",
      location: "北京",
      subject: "",
      transcriber: null,
    };
    const without = buildDocxExportMetaLine("口述史", new Date("2026-06-08T12:00:00"), {
      includeProjectMetadata: false,
      metadata,
    });
    expect(without).toBe("");
    expect(without).not.toContain("讲述人：张三");

    const withMeta = buildDocxExportMetaLine("口述史", new Date("2026-06-08T12:00:00"), {
      includeProjectMetadata: true,
      metadata,
    });
    expect(withMeta).toContain("讲述人：张三");
    expect(withMeta).toContain("地点：北京");
    expect(withMeta).not.toContain("导出：");
    expect(withMeta).not.toContain("主题：");
    expect(withMeta).not.toContain("转录人：");
  });
});

describe("listDocxProjectMetadataPreviewLines", () => {
  it("returns only filled metadata fields", () => {
    const lines = listDocxProjectMetadataPreviewLines({
      narrator: "张三",
      recorded_at: "  ",
      location: "北京",
      subject: null,
      transcriber: undefined,
    });
    expect(lines).toEqual([
      { label: "讲述人", value: "张三" },
      { label: "地点", value: "北京" },
    ]);
  });
});

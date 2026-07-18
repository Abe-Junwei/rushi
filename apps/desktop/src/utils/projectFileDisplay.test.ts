import { describe, expect, it } from "vitest";
import {
  formatFileDurationSec,
  formatHubFileAudioMetaLine,
  formatHubFileEmptyProgressLabel,
  formatHubFileProgressMetaLine,
  formatHubFileStageLegend,
  formatImportSourceSize,
  formatProjectHubMetadataLine,
  hubFileRowMetaLines,
  hubFileStageCounts,
} from "./projectFileDisplay";
import type { FileSummary } from "../tauri/projectTypes";

describe("formatProjectHubMetadataLine", () => {
  it("joins time, subject, and narrator with middle dots", () => {
    expect(
      formatProjectHubMetadataLine({
        recorded_at: "2024-03",
        subject: "家族口述",
        narrator: "张三",
      }),
    ).toBe("2024-03 · 家族口述 · 张三");
  });

  it("omits empty fields", () => {
    expect(
      formatProjectHubMetadataLine({
        recorded_at: "  ",
        subject: "主题",
        narrator: null,
      }),
    ).toBe("主题");
  });

  it("returns null when nothing is filled", () => {
    expect(formatProjectHubMetadataLine({})).toBeNull();
  });
});

describe("hub file row meta", () => {
  const base: FileSummary = {
    id: "f1",
    name: "采访",
    file_type: "paired",
    updated_at_ms: Date.parse("2026-07-17T10:05:00"),
    duration_sec: 125,
    segment_count: 10,
    draft_count: 5,
    first_proof_count: 2,
    finalized_count: 3,
    import_source_size: 128 * 1024 * 1024,
    media_missing: false,
  };

  it("formats duration and size helpers", () => {
    expect(formatFileDurationSec(125)).toBe("2:05");
    expect(formatFileDurationSec(null)).toBe("时长未知");
    expect(formatImportSourceSize(128 * 1024 * 1024)).toBe("128 MB");
  });

  it("audio meta line only for Hub list (progress is the meter)", () => {
    const lines = hubFileRowMetaLines(base);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("音频");
    expect(lines[0]).toContain("2:05");
    expect(lines[0]).toContain("128 MB");
  });

  it("labels media as 音频 regardless of segment counts", () => {
    expect(formatHubFileAudioMetaLine(base)).toMatch(/^音频 ·/);
    expect(
      formatHubFileAudioMetaLine({
        ...base,
        segment_count: 0,
        draft_count: 0,
        first_proof_count: 0,
        finalized_count: 0,
      }),
    ).toMatch(/^音频 ·/);
  });

  it("can insert project name before updated time", () => {
    expect(formatHubFileAudioMetaLine(base, { projectName: "开示转录" })).toContain(
      " · 开示转录 · ",
    );
  });

  it("reconciles stage counts from total", () => {
    expect(hubFileStageCounts(base)).toEqual({
      draft: 5,
      firstProof: 2,
      finalized: 3,
      total: 10,
    });
    // Stale draft_count must not invent content when total is 0
    expect(
      hubFileStageCounts({
        ...base,
        segment_count: 0,
        draft_count: 9,
        first_proof_count: 0,
        finalized_count: 0,
      }),
    ).toEqual({ draft: 0, firstProof: 0, finalized: 0, total: 0 });
  });

  it("empty / live progress labels", () => {
    expect(formatHubFileEmptyProgressLabel(base)).toBe("未转录");
    expect(formatHubFileEmptyProgressLabel({ ...base, file_type: "text" })).toBe("无语段");
    expect(
      formatHubFileProgressMetaLine({
        ...base,
        segment_count: 0,
        draft_count: 0,
        first_proof_count: 0,
        finalized_count: 0,
      }),
    ).toBe("未转录");
    expect(formatHubFileProgressMetaLine(base)).toBe("生稿 5 · 一校 2 · 定稿 3");
    expect(
      formatHubFileStageLegend({ draft: 3472, firstProof: 0, finalized: 2, total: 3474 }),
    ).toBe("生稿 3472 · 定稿 2");
    expect(formatHubFileProgressMetaLine(base, { kind: "transcribing", percent: 45 })).toBe(
      "转写中 · 45%",
    );
    expect(formatHubFileProgressMetaLine(base, { kind: "queued" })).toBe("排队中");
  });

  it("marks 缺媒体 on audio meta", () => {
    expect(
      formatHubFileAudioMetaLine({ ...base, media_missing: true, duration_sec: null }),
    ).toContain("缺媒体");
  });
});

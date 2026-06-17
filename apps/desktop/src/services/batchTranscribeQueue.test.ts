import { describe, expect, it } from "vitest";
import {
  applyBatchQueueStop,
  initialBatchQueueItems,
  isBatchTranscribableFile,
  patchBatchQueueItem,
  shouldSkipBatchTranscribe,
  summarizeBatchQueue,
} from "./batchTranscribeQueue";
import type { FileSummary } from "../tauri/projectTypes";

function file(partial: Partial<FileSummary> & Pick<FileSummary, "id" | "name" | "file_type">): FileSummary {
  return {
    updated_at_ms: 0,
    ...partial,
  };
}

describe("batchTranscribeQueue", () => {
  it("lists paired and audio_only files", () => {
    const files = [
      file({ id: "1", name: "a.wav", file_type: "paired" }),
      file({ id: "2", name: "b.txt", file_type: "text" }),
      file({ id: "3", name: "c.wav", file_type: "audio_only" }),
    ];
    expect(isBatchTranscribableFile(files[0])).toBe(true);
    expect(isBatchTranscribableFile(files[1])).toBe(false);
    expect(initialBatchQueueItems(files)).toHaveLength(2);
  });

  it("shouldSkipBatchTranscribe when any segment has text", () => {
    expect(shouldSkipBatchTranscribe([{ idx: 0, start_sec: 0, end_sec: 1, text: " " }])).toBe(
      false,
    );
    expect(
      shouldSkipBatchTranscribe([{ idx: 0, start_sec: 0, end_sec: 1, text: "你好" }]),
    ).toBe(true);
  });

  it("patchBatchQueueItem updates one row", () => {
    const items = initialBatchQueueItems([
      file({ id: "1", name: "a.wav", file_type: "paired" }),
    ]);
    const next = patchBatchQueueItem(items, "1", { status: "done" });
    expect(next[0]?.status).toBe("done");
    expect(summarizeBatchQueue(next).done).toBe(1);
  });

  it("orders queue newest-first like Hub", () => {
    const items = initialBatchQueueItems([
      file({ id: "old", name: "old.wav", file_type: "paired", updated_at_ms: 100 }),
      file({ id: "new", name: "new.wav", file_type: "paired", updated_at_ms: 300 }),
      file({ id: "mid", name: "mid.wav", file_type: "audio_only", updated_at_ms: 200 }),
    ]);
    expect(items.map((i) => i.fileId)).toEqual(["new", "mid", "old"]);
  });

  it("applyBatchQueueStop marks running failed and pending skipped", () => {
    const items = [
      { fileId: "1", fileName: "a", status: "done" as const },
      { fileId: "2", fileName: "b", status: "running" as const },
      { fileId: "3", fileName: "c", status: "pending" as const },
    ];
    const next = applyBatchQueueStop(items);
    expect(next[0]?.status).toBe("done");
    expect(next[1]).toMatchObject({ status: "failed", detail: "已停止" });
    expect(next[2]).toMatchObject({ status: "skipped", detail: "未处理（已停止）" });
  });
});

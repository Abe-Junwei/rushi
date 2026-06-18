import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearActivityFeedForTests, getActivityFeedSnapshot } from "./activityFeed";
import { dismissToast, getToasts } from "./toast";
import {
  pushActivity,
  pushBatchTranscribeSummaryActivity,
  pushExportFailureActivity,
} from "./pushActivity";

describe("pushActivity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dismissToast();
    vi.setSystemTime(1_700_000_000_000);
    clearActivityFeedForTests();
  });

  afterEach(() => {
    dismissToast();
    clearActivityFeedForTests();
    vi.useRealTimers();
  });

  it("writes structured batch items without duplicating generic toast mirror", () => {
    pushBatchTranscribeSummaryActivity({
      projectId: "proj-1",
      projectLabel: "访谈 A",
      done: 2,
      skipped: 1,
      failed: 0,
      stopped: false,
    });
    const item = getActivityFeedSnapshot()[0];
    expect(item?.kind).toBe("batch_transcribe");
    expect(item?.projectId).toBe("proj-1");
    expect(item?.fileLabel).toBe("访谈 A");
    expect(getToasts()).toHaveLength(1);
  });

  it("persists export failure with open-file action kind", () => {
    pushExportFailureActivity({
      formatLabel: "TXT",
      errorMessage: "磁盘已满",
      projectId: "proj-1",
      fileId: "file-1",
      fileLabel: "a.wav",
    });
    const item = getActivityFeedSnapshot()[0];
    expect(item?.kind).toBe("export");
    expect(item?.actionKind).toBe("open-file");
    expect(item?.actionLabel).toBe("打开文件");
  });

  it("lists batch summary before failed file entries", () => {
    pushBatchTranscribeSummaryActivity({
      projectId: "proj-1",
      projectLabel: "访谈 A",
      done: 1,
      skipped: 0,
      failed: 2,
      stopped: false,
      failedFiles: [
        { fileId: "f1", fileName: "a.wav", detail: "ASR 超时" },
        { fileId: "f2", fileName: "b.wav", detail: "已停止" },
      ],
    });
    const items = getActivityFeedSnapshot();
    expect(items[0]?.message).toMatch(/批量转写完成/);
    expect(items).toHaveLength(2);
    expect(items[1]?.fileId).toBe("f1");
    expect(getToasts()).toHaveLength(1);
  });

  it("skips feed mirror when showToast is false", () => {
    pushActivity({
      variant: "success",
      message: "静默写入",
      showToast: false,
    });
    expect(getActivityFeedSnapshot()).toHaveLength(1);
    expect(getToasts()).toHaveLength(0);
  });
});

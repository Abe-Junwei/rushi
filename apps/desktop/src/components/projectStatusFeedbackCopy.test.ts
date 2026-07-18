import { describe, expect, it } from "vitest";
import { busyOverlayCopy, transcribeCancelStoppingLabel } from "./projectStatusFeedbackCopy";

describe("busyOverlayCopy transcribe", () => {
  it("online waiting copy does not mention sidecar or preview", () => {
    const copy = busyOverlayCopy("transcribe", null, { transcribeSource: "online" });
    expect(copy.title).toBe("在线转写中");
    expect(copy.lead).toMatch(/云端识别/);
    expect(copy.detail).toMatch(/一次性写入/);
    expect(copy.lead).not.toMatch(/侧车|预览|分段处理/);
  });

  it("local incremental preview copy mentions segments and determinate progress", () => {
    const copy = busyOverlayCopy(
      "transcribe",
      { windowIndex: 2, windowCount: 5, segmentsTotal: 12 },
      { transcribeSource: "local", elapsedSec: 120 },
    );
    expect(copy.title).toBe("本机转写中");
    expect(copy.lead).toMatch(/第 2\/5 段/);
    expect(copy.detail).toMatch(/12 条语段/);
    expect(copy.progressValue).toBeCloseTo(0.4);
    expect(copy.detail).toMatch(/约剩余/);
  });

  it("local single-window path stays indeterminate without fake ETA", () => {
    const copy = busyOverlayCopy(
      "transcribe",
      { windowIndex: 1, windowCount: 1, segmentsTotal: 3 },
      { transcribeSource: "local", elapsedSec: 90 },
    );
    expect(copy.progressValue).toBeUndefined();
    expect(copy.detail).not.toMatch(/约剩余|预计/);
  });

  it("local default copy mentions incremental segments", () => {
    const copy = busyOverlayCopy("transcribe", null, { transcribeSource: "local" });
    expect(copy.title).toBe("本机转写中");
    expect(copy.lead).toMatch(/逐步出现/);
    expect(copy.detail).toMatch(/分段识别/);
    expect(copy.lead).not.toMatch(/侧车/);
  });
});

describe("busyOverlayCopy export", () => {
  it("bundle export uses packing copy without Word", () => {
    const copy = busyOverlayCopy("export", null);
    expect(copy.title).toBe("正在导出内容包");
    expect(copy.lead).toBe("打包中，请稍候");
    expect(copy.title).not.toMatch(/Word/);
    expect(copy.detail).toBeUndefined();
  });

  it("plain Word export does not mention optional polish", () => {
    const copy = busyOverlayCopy("export_docx", null);
    expect(copy.title).toBe("正在导出 Word");
    expect(copy.lead).toBe("写入文档");
    expect(copy.detail).toBeUndefined();
  });

  it("polish export falls back to generic wording without batch progress", () => {
    const copy = busyOverlayCopy("export_polish", null);
    expect(copy.title).toBe("正在导出 Word");
    expect(copy.lead).toBe("大模型润色并写入文档");
    expect(copy.detail).toMatch(/数分钟/);
    expect(copy.detail).not.toMatch(/预计/);
  });

  it("polish export shows batch i/N when multi-batch", () => {
    const copy = busyOverlayCopy("export_polish", null, {
      exportPolishProgress: { batch: 2, total: 5 },
    });
    expect(copy.lead).toBe("第 2/5 批");
    expect(copy.detail).toBe("大模型润色中");
  });

  it("polish export ignores single-batch progress in lead", () => {
    const copy = busyOverlayCopy("export_polish", null, {
      exportPolishProgress: { batch: 1, total: 1 },
    });
    expect(copy.lead).toBe("大模型润色并写入文档");
  });
});

describe("transcribeCancelStoppingLabel", () => {
  it("online uses short stopping label", () => {
    expect(transcribeCancelStoppingLabel("online")).toBe("正在停止…");
  });

  it("local mentions segment boundary", () => {
    expect(transcribeCancelStoppingLabel("local")).toContain("当前段");
  });
});

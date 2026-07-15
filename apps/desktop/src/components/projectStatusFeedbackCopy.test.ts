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

  it("local incremental preview copy mentions segments", () => {
    const copy = busyOverlayCopy(
      "transcribe",
      { windowIndex: 2, windowCount: 5, segmentsTotal: 12 },
      { transcribeSource: "local" },
    );
    expect(copy.title).toBe("本机转写中");
    expect(copy.lead).toMatch(/第 2\/5 段/);
    expect(copy.detail).toMatch(/12 条语段/);
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
  it("plain export does not mention optional polish", () => {
    const copy = busyOverlayCopy("export", null);
    expect(copy.title).toBe("正在导出 Word");
    expect(copy.lead).toBe("写入文档");
    expect(copy.detail).toBeUndefined();
  });

  it("polish export falls back to generic wording without an estimate", () => {
    const copy = busyOverlayCopy("export_polish", null);
    expect(copy.title).toBe("正在导出 Word");
    expect(copy.lead).toBe("大模型润色并写入文档");
    expect(copy.detail).toMatch(/数十秒/);
  });

  it("polish export shows a seconds estimate for short bodies", () => {
    const copy = busyOverlayCopy("export_polish", null, { exportPolishEstimateSecs: 45 });
    expect(copy.detail).toBe("处理预计约 45 秒");
  });

  it("polish export shows a minutes estimate for long bodies", () => {
    const copy = busyOverlayCopy("export_polish", null, { exportPolishEstimateSecs: 360 });
    expect(copy.detail).toBe("处理预计约 6 分钟");
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

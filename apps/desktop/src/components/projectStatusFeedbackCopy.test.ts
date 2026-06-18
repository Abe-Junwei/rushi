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

describe("transcribeCancelStoppingLabel", () => {
  it("online uses short stopping label", () => {
    expect(transcribeCancelStoppingLabel("online")).toBe("正在停止…");
  });

  it("local mentions segment boundary", () => {
    expect(transcribeCancelStoppingLabel("local")).toContain("当前段");
  });
});

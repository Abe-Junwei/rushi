import { describe, expect, it } from "vitest";
import type { BusyReason } from "../pages/useProjectController";

/** Mirror of ProjectStatusFeedback busyOverlayCopy for R3t-B hand-test proxy. */
function busyOverlayCopy(reason: BusyReason | null): { title: string; hint: string } {
  switch (reason) {
    case "transcribe":
      return { title: "正在从 ASR 拉取语段...", hint: "完整识别可能需数分钟" };
    case "save":
      return { title: "正在保存到 SQLite...", hint: "请勿关闭应用" };
    default:
      return { title: "处理中...", hint: "请稍候" };
  }
}

describe("ProjectBusyOverlay transcribe copy (R3t-B)", () => {
  it("shows transcribe-specific title and hint", () => {
    const copy = busyOverlayCopy("transcribe");
    expect(copy.title).toContain("ASR");
    expect(copy.hint).toMatch(/数分钟/);
  });
});

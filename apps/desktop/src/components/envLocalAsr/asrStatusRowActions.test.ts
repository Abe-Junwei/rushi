import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveAsrStatusRowAction } from "./asrStatusRowActions";

const isPackagedDesktopApp = vi.fn(() => false);

vi.mock("../../config/env", () => ({
  isPackagedDesktopApp: () => isPackagedDesktopApp(),
}));

describe("resolveAsrStatusRowAction", () => {
  beforeEach(() => {
    isPackagedDesktopApp.mockReturnValue(false);
  });

  it("returns null for ready rows", () => {
    expect(resolveAsrStatusRowAction({ id: "env", label: "环境", ok: true, text: "ok" }, "ok")).toBeNull();
  });

  it("routes transcribe failures to models section", () => {
    const action = resolveAsrStatusRowAction(
      { id: "transcribe", label: "转写", ok: false, text: "不可用" },
      "ok",
    );
    expect(action?.label).toBe("前往模型");
    expect(action?.navigate).toEqual(expect.any(Function));
  });

  it("routes env error to setup section", () => {
    const action = resolveAsrStatusRowAction({ id: "env", label: "环境", ok: false, text: "失败" }, "error");
    expect(action?.label).toBe("查看安装向导");
    expect(action?.navigate).toEqual(expect.any(Function));
  });

  it("routes ffmpeg failures to setup wizard repair in dev", () => {
    const action = resolveAsrStatusRowAction(
      { id: "ffmpeg", label: "FFmpeg", ok: false, text: "未检测到" },
      "ok",
    );
    expect(action?.label).toBe("修复侧车");
  });

  it("routes ffmpeg failures to one-click prepare in packaged app", () => {
    isPackagedDesktopApp.mockReturnValue(true);
    const action = resolveAsrStatusRowAction(
      { id: "ffmpeg", label: "FFmpeg", ok: false, text: "未检测到" },
      "ok",
    );
    expect(action?.label).toBe("一键准备");
  });
});

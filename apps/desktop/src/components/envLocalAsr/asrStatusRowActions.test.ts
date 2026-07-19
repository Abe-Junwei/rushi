import { describe, expect, it, vi } from "vitest";
import { resolveAsrStatusRowAction } from "./asrStatusRowActions";

describe("resolveAsrStatusRowAction", () => {
  it("returns null for ready rows", () => {
    expect(resolveAsrStatusRowAction({ id: "env", label: "环境", ok: true, text: "ok" }, "ok")).toBeNull();
  });

  it("routes transcribe failures to models section when connected", () => {
    const action = resolveAsrStatusRowAction(
      { id: "transcribe", label: "转写", ok: false, text: "不可用" },
      "ok",
    );
    expect(action?.label).toBe("前往模型");
    expect(action?.navigate).toEqual(expect.any(Function));
  });

  it("routes env error to setup section with honest wizard label", () => {
    const action = resolveAsrStatusRowAction({ id: "env", label: "环境", ok: false, text: "失败" }, "error");
    expect(action?.label).toBe("打开安装向导");
    expect(action?.navigate).toEqual(expect.any(Function));
  });

  it("routes ffmpeg failures to open wizard (navigate-only)", () => {
    const action = resolveAsrStatusRowAction(
      { id: "ffmpeg", label: "FFmpeg", ok: false, text: "未检测到" },
      "ok",
    );
    expect(action?.label).toBe("打开安装向导");
  });

  it("binds recover sidecar when idle sleeping", () => {
    const onRecoverSidecar = vi.fn();
    const action = resolveAsrStatusRowAction(
      { id: "env", label: "环境", ok: false, text: "已休眠", warn: true },
      { health: "error", sidecarIdleSleeping: true, onRecoverSidecar },
    );
    expect(action?.label).toBe("恢复侧车");
    action?.navigate();
    expect(onRecoverSidecar).toHaveBeenCalled();
  });
});

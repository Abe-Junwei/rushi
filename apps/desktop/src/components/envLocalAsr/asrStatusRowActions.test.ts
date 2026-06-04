import { describe, expect, it } from "vitest";
import { resolveAsrStatusRowAction } from "./asrStatusRowActions";

describe("resolveAsrStatusRowAction", () => {
  it("returns null for ready rows", () => {
    expect(resolveAsrStatusRowAction({ id: "env", label: "环境", ok: true, text: "ok" }, "ok")).toBeNull();
  });

  it("routes transcribe failures to models section", () => {
    expect(
      resolveAsrStatusRowAction({ id: "transcribe", label: "转写", ok: false, text: "不可用" }, "ok"),
    ).toEqual({ label: "前往模型", targetId: "env-asr-models" });
  });

  it("routes env error to setup section", () => {
    expect(
      resolveAsrStatusRowAction({ id: "env", label: "环境", ok: false, text: "失败" }, "error"),
    ).toEqual({ label: "查看安装向导", targetId: "env-asr-setup" });
  });
});

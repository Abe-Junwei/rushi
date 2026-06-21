import { describe, expect, it, vi, beforeEach } from "vitest";
import { describePrepareModelFailure } from "./prepareModelDownloadCopy";

const readShellManagesBundledSidecarSync = vi.fn(() => false);
const usesBundledAsrModelStack = vi.fn(() => false);

vi.mock("../services/shellCapabilities", () => ({
  readShellManagesBundledSidecarSync: () => readShellManagesBundledSidecarSync(),
}));

vi.mock("../services/asr/bundledModelJobPresentation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/asr/bundledModelJobPresentation")>();
  return {
    ...actual,
    usesBundledAsrModelStack: () => usesBundledAsrModelStack(),
  };
});

describe("describePrepareModelFailure", () => {
  beforeEach(() => {
    readShellManagesBundledSidecarSync.mockReturnValue(false);
    usesBundledAsrModelStack.mockReturnValue(false);
  });

  it("maps funasr_not_installed", () => {
    const r = describePrepareModelFailure("funasr_not_installed");
    expect(r.headline).toContain("FunASR");
    expect(r.tips.length).toBeGreaterThan(0);
  });

  it("maps client_timeout for dev ModelScope path", () => {
    const r = describePrepareModelFailure("client_timeout");
    expect(r.headline).toContain("15");
    expect(r.tips.some((t) => t.includes("重试"))).toBe(true);
  });

  it("maps disk full", () => {
    const r = describePrepareModelFailure("model_prepare_disk_full");
    expect(r.headline).toContain("磁盘");
  });

  it("maps fetch_failed", () => {
    const r = describePrepareModelFailure("fetch_failed");
    expect(r.headline).toContain("无法连接");
  });

  it("modelscope_not_installed uses managed tips without dev venv hints", () => {
    readShellManagesBundledSidecarSync.mockReturnValue(true);
    const r = describePrepareModelFailure("modelscope_not_installed");
    expect(r.tips.some((t) => t.includes("重新打开") || t.includes("清除模型缓存"))).toBe(true);
    expect(r.tips.some((t) => t.includes("venv"))).toBe(false);
  });

  it("maps raw HTTPSConnectionPool errors to network guidance", () => {
    const r = describePrepareModelFailure(
      "HTTPSConnectionPool(host='www.modelscope.cn', port=443): Max retries exceeded",
    );
    expect(r.headline).toContain("网络中断");
    expect(r.headline).not.toContain("HTTPSConnectionPool");
  });

  describe("bundled release stack", () => {
    beforeEach(() => {
      usesBundledAsrModelStack.mockReturnValue(true);
      readShellManagesBundledSidecarSync.mockReturnValue(true);
    });

    it("maps client_timeout to copy wording", () => {
      const r = describePrepareModelFailure("client_timeout");
      expect(r.headline).toContain("复制");
      expect(r.tips.some((t) => t.includes("重启应用"))).toBe(true);
    });

    it("maps modelscope_not_installed to bundled guidance", () => {
      const r = describePrepareModelFailure("modelscope_not_installed");
      expect(r.headline).toContain("不应出现 ModelScope");
      expect(r.tips.some((t) => t.includes("重新打开"))).toBe(true);
    });

    it("maps network errors to bundled copy guidance", () => {
      const r = describePrepareModelFailure("model_prepare_network_error");
      expect(r.headline).toContain("不应依赖网络");
    });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { describePrepareModelFailure } from "./prepareModelDownloadCopy";

const readShellManagesBundledSidecarSync = vi.fn(() => false);
vi.mock("../services/shellCapabilities", () => ({
  readShellManagesBundledSidecarSync: () => readShellManagesBundledSidecarSync(),
}));

describe("describePrepareModelFailure", () => {
  beforeEach(() => {
    readShellManagesBundledSidecarSync.mockReturnValue(false);
  });

  it("maps funasr_not_installed", () => {
    const r = describePrepareModelFailure("funasr_not_installed");
    expect(r.headline).toContain("FunASR");
    expect(r.tips.length).toBeGreaterThan(0);
  });

  it("maps client_timeout", () => {
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

  it("modelscope_not_installed uses packaged tips in release", () => {
    readShellManagesBundledSidecarSync.mockReturnValue(true);
    const r = describePrepareModelFailure("modelscope_not_installed");
    expect(r.tips.some((t) => t.includes("一键准备"))).toBe(true);
    expect(r.tips.some((t) => t.includes("venv"))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { describePrepareModelFailure } from "./prepareModelDownloadCopy";

describe("describePrepareModelFailure", () => {
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
});

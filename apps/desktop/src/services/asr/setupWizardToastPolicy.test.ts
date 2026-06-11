import { describe, expect, it } from "vitest";
import { resolveSetupWizardToast, setupWizardToastClaimsTranscribeReady } from "./setupWizardToastPolicy";

describe("setupWizardToastPolicy", () => {
  it("detects transcribe-ready claims in setup copy", () => {
    expect(setupWizardToastClaimsTranscribeReady("一键准备完成，可直接开始转写。")).toBe(true);
    expect(setupWizardToastClaimsTranscribeReady("正在下载模型…")).toBe(false);
  });

  it("suppresses toast while model download is active", () => {
    expect(
      resolveSetupWizardToast({
        setupMessage: "一键准备完成，可直接开始转写。",
        setupOutcome: "ready",
        prepareModelBusy: true,
      }),
    ).toEqual({ emit: false });
  });

  it("downgrades ready toast when blockReason exists", () => {
    expect(
      resolveSetupWizardToast({
        setupMessage: "已使用当前 8741 服务，可直接开始转写。",
        setupOutcome: "ready",
        prepareModelBusy: false,
        transcribeBlockReason: "所选模型正在下载，完成后方可转写。",
      }),
    ).toEqual({
      emit: true,
      variant: "warning",
      message: "所选模型正在下载，完成后方可转写。",
    });
  });
});

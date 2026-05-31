import { describe, expect, it, vi } from "vitest";
import { resolveTranscribeExecuteBlock } from "./transcribeExecuteGate";

vi.mock("../services/stt/sttOnlineProviderContract", () => ({
  isSttOnlineEnabledButIncomplete: vi.fn(() => false),
  tryBuildOnlineTranscribeBridgePayload: vi.fn(() => null),
}));

import {
  isSttOnlineEnabledButIncomplete,
  tryBuildOnlineTranscribeBridgePayload,
} from "../services/stt/sttOnlineProviderContract";

describe("resolveTranscribeExecuteBlock", () => {
  it("returns file hint when no file is open", () => {
    expect(
      resolveTranscribeExecuteBlock({
        busy: false,
        hasCurrent: true,
        currentFileId: null,
        localTranscribePreflight: () => null,
      }),
    ).toBe("请先打开一个文件后再拉取语段");
  });

  it("returns busy sentinel without user message", () => {
    expect(
      resolveTranscribeExecuteBlock({
        busy: true,
        hasCurrent: true,
        currentFileId: "f1",
        localTranscribePreflight: () => null,
      }),
    ).toBe("busy");
  });

  it("returns local preflight message for local path", () => {
    vi.mocked(tryBuildOnlineTranscribeBridgePayload).mockReturnValue(null);
    expect(
      resolveTranscribeExecuteBlock({
        busy: false,
        hasCurrent: true,
        currentFileId: "f1",
        localTranscribePreflight: () => "本机 ASR 未就绪",
      }),
    ).toBe("本机 ASR 未就绪");
  });

  it("returns online STT incomplete message", () => {
    vi.mocked(isSttOnlineEnabledButIncomplete).mockReturnValue(true);
    expect(
      resolveTranscribeExecuteBlock({
        busy: false,
        hasCurrent: true,
        currentFileId: "f1",
        localTranscribePreflight: () => null,
      }),
    ).toContain("在线 STT");
  });
});

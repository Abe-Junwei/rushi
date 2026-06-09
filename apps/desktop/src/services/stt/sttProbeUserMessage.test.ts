import { describe, expect, it } from "vitest";
import { formatSttProbeFailureMessage } from "./sttProbeUserMessage";

describe("formatSttProbeFailureMessage", () => {
  it("prefers business message over raw state", () => {
    expect(
      formatSttProbeFailureMessage({
        state: "unauthorized",
        available: false,
        message: "密钥被拒绝 (401)。",
      }),
    ).toBe("密钥被拒绝 (401)。");
  });

  it("maps state to Chinese label when message missing", () => {
    expect(
      formatSttProbeFailureMessage({
        state: "timeout",
        available: false,
      }),
    ).toBe("探测超时");
  });
});

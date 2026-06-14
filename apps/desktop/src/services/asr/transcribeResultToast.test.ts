import { describe, expect, it } from "vitest";
import {
  buildTranscribeResultSummary,
  countTranscribeCharacters,
  formatTranscribeElapsedLabel,
  resolveTranscribeResultPresentation,
} from "./transcribeResultToast";

describe("transcribeResultToast", () => {
  it("formats elapsed under one minute", () => {
    expect(formatTranscribeElapsedLabel(12_500)).toBe("13 秒");
  });

  it("formats elapsed over one minute", () => {
    expect(formatTranscribeElapsedLabel(125_000)).toBe("2 分 5 秒");
  });

  it("counts characters across segments without punctuation", () => {
    expect(
      countTranscribeCharacters([
        { text: "你好" },
        { text: "，世界。" },
        { text: null },
      ]),
    ).toBe(4);
  });

  it("builds summary with elapsed, segment count, and characters", () => {
    expect(
      buildTranscribeResultSummary({
        segmentCount: 42,
        charCount: 12345,
        elapsedMs: 90_000,
      }),
    ).toBe("转写完成：用时 1 分 30 秒，42 条语段，12,345 字");
  });

  it("warns when transcribe finishes with zero segments", () => {
    expect(
      resolveTranscribeResultPresentation({
        segmentCount: 0,
        charCount: 0,
        elapsedMs: 5_000,
      }),
    ).toEqual({
      summary: "转写结束：未生成语段（用时 5 秒）",
      variant: "warning",
      showDeliveryModeAction: false,
    });
  });

  it("warns when segments exist but all text is empty", () => {
    expect(
      resolveTranscribeResultPresentation({
        segmentCount: 3,
        charCount: 0,
        elapsedMs: 8_000,
      }),
    ).toEqual({
      summary: "转写结束：语段正文均为空（用时 8 秒）",
      variant: "warning",
      showDeliveryModeAction: false,
    });
  });
});

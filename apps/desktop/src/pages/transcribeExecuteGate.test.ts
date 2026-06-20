import { describe, expect, it, vi } from "vitest";
import { resolveTranscribeExecuteBlock } from "./transcribeExecuteGate";

vi.mock("../services/stt/sttOnlineProviderContract", () => ({
  resolveOnlineTranscribeBlock: vi.fn(() => null),
}));

import { resolveOnlineTranscribeBlock } from "../services/stt/sttOnlineProviderContract";

describe("resolveTranscribeExecuteBlock", () => {
  it("returns file hint when no file is open", () => {
    expect(
      resolveTranscribeExecuteBlock({
        busy: false,
        hasCurrent: true,
        currentFileId: null,
        localTranscribePreflight: () => null,
        source: "local",
      }),
    ).toBe("请先打开一个文件后再自动转录");
  });

  it("returns busy sentinel without user message", () => {
    expect(
      resolveTranscribeExecuteBlock({
        busy: true,
        hasCurrent: true,
        currentFileId: "f1",
        localTranscribePreflight: () => null,
        source: "local",
      }),
    ).toBe("busy");
  });

  it("returns local preflight message for local source", () => {
    expect(
      resolveTranscribeExecuteBlock({
        busy: false,
        hasCurrent: true,
        currentFileId: "f1",
        localTranscribePreflight: () => "本机 ASR 未就绪",
        source: "local",
      }),
    ).toBe("本机 ASR 未就绪");
  });

  it("returns online STT block message when source is online", () => {
    vi.mocked(resolveOnlineTranscribeBlock).mockReturnValue("在线 STT：配置不完整");
    expect(
      resolveTranscribeExecuteBlock({
        busy: false,
        hasCurrent: true,
        currentFileId: "f1",
        localTranscribePreflight: () => null,
        source: "online",
      }),
    ).toContain("在线 STT");
  });

  it("allows batch child when batch_transcribe busy", () => {
    expect(
      resolveTranscribeExecuteBlock({
        busy: true,
        busyReason: "batch_transcribe",
        batchChild: true,
        hasCurrent: true,
        currentFileId: "f1",
        localTranscribePreflight: () => null,
        source: "local",
      }),
    ).toBeNull();
  });

  it("allows batch child with explicit targetFileId when currentFileId is null", () => {
    expect(
      resolveTranscribeExecuteBlock({
        busy: true,
        busyReason: "batch_transcribe",
        batchChild: true,
        hasCurrent: true,
        currentFileId: null,
        targetFileId: "f-batch",
        localTranscribePreflight: () => null,
        source: "local",
      }),
    ).toBeNull();
  });

  it("skips local preflight for batch child while batch_transcribe busy", () => {
    expect(
      resolveTranscribeExecuteBlock({
        busy: true,
        busyReason: "batch_transcribe",
        batchChild: true,
        hasCurrent: true,
        currentFileId: "f1",
        localTranscribePreflight: () => "本机 ASR 未就绪",
        source: "local",
      }),
    ).toBeNull();
  });

  it("uses online gate when local source but online is effectively active", () => {
    vi.mocked(resolveOnlineTranscribeBlock).mockReturnValue(null);
    expect(
      resolveTranscribeExecuteBlock({
        busy: false,
        hasCurrent: true,
        currentFileId: "f1",
        localTranscribePreflight: () => "所选模型正在下载，完成后方可转写。",
        source: "local",
        onlineReady: true,
      }),
    ).toBeNull();
    expect(resolveOnlineTranscribeBlock).toHaveBeenCalled();
  });

  it("still uses local preflight when user locked local while online ready", () => {
    const storage: Record<string, string> = { "rushi.transcribe.source.userOverride": "local" };
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        for (const key of Object.keys(storage)) delete storage[key];
      },
      get length() {
        return Object.keys(storage).length;
      },
      key: (index: number) => Object.keys(storage)[index] ?? null,
    });
    vi.mocked(resolveOnlineTranscribeBlock).mockClear();
    expect(
      resolveTranscribeExecuteBlock({
        busy: false,
        hasCurrent: true,
        currentFileId: "f1",
        localTranscribePreflight: () => "所选模型正在下载，完成后方可转写。",
        source: "local",
        onlineReady: true,
      }),
    ).toContain("下载");
    expect(resolveOnlineTranscribeBlock).not.toHaveBeenCalled();
  });
});

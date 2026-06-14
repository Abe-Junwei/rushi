import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const logRuntimeParityMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../../config/env", () => ({
  isTauriRuntime: () => true,
}));

vi.mock("../runtimeParity", () => ({
  logRuntimeParity: (...args: unknown[]) => logRuntimeParityMock(...args),
}));

import { probeWaveformAssetFetchParity } from "./waveformAssetFetchParity";

describe("probeWaveformAssetFetchParity", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    logRuntimeParityMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        }),
      ),
    );
  });

  it("logs WARN when fetched bytes are shorter than disk", async () => {
    invokeMock.mockResolvedValue({ diskBytes: 1_000_000 });
    await probeWaveformAssetFetchParity("test", "/tmp/a.wav", "asset://a.wav");
    expect(logRuntimeParityMock).toHaveBeenCalledWith(
      "waveform",
      expect.stringContaining("fetched=100"),
      "WARN",
    );
  });

  it("logs INFO when fetch matches disk size", async () => {
    invokeMock.mockResolvedValue({ diskBytes: 100 });
    await probeWaveformAssetFetchParity("test", "/tmp/a.wav", "asset://a.wav");
    expect(logRuntimeParityMock).toHaveBeenCalledWith(
      "waveform",
      expect.stringContaining("ratio=1.0000"),
      "INFO",
    );
  });
});

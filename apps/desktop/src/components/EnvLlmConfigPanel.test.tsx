import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnvLlmConfigPanel } from "./EnvLlmConfigPanel";
import { DEFAULT_LLM_API_KEY_ID, applyLlmProviderPreset, persistLlmRuntimeConfig } from "../services/postprocess/postprocessRuntimeContract";

const llmProbeConnection = vi.fn<
  (req: unknown) => Promise<{ ok: boolean; message: string; status?: number; latency_ms?: number }>
>();

vi.mock("../tauri/postprocessApi", () => ({
  llmProbeConnection: (req: unknown) => llmProbeConnection(req),
  llmSaveApiKey: vi.fn(),
  llmDeleteApiKey: vi.fn(),
}));

function installMockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
}

describe("EnvLlmConfigPanel", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
    llmProbeConnection.mockReset();
  });

  it("hides ready hint after a failed probe", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    llmProbeConnection.mockResolvedValue({
      ok: false,
      status: 401,
      message: "认证失败（HTTP 401），请检查 API Key。",
    });

    render(<EnvLlmConfigPanel busy={false} />);
    expect(screen.getByText(/连接就绪：编辑器中的 LLM 能力/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "探测连接" }));

    await waitFor(() => {
      expect(screen.getByText("认证失败（HTTP 401），请检查 API Key。")).toBeTruthy();
    });
    expect(screen.queryByText(/连接就绪：编辑器中的 LLM 能力/)).toBeNull();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnvLlmConfigPanel } from "./EnvLlmConfigPanel";
import { DEFAULT_LLM_API_KEY_ID, applyLlmProviderPreset, persistLlmRuntimeConfig } from "../services/postprocess/postprocessRuntimeContract";

const llmProbeConnection = vi.fn<
  (req: unknown) => Promise<{ ok: boolean; message: string; status?: number; latency_ms?: number }>
>();
const llmSaveApiKey = vi.fn<(req: unknown) => Promise<string>>();
const llmHasStoredApiKey = vi.fn<(req: unknown) => Promise<boolean>>();

vi.mock("../tauri/postprocessApi", () => ({
  llmProbeConnection: (req: unknown) => llmProbeConnection(req),
  llmSaveApiKey: (req: unknown) => llmSaveApiKey(req),
  llmDeleteApiKey: vi.fn(),
  llmHasStoredApiKey: (req: unknown) => llmHasStoredApiKey(req),
  llmMigrateLegacyApiKey: vi.fn().mockResolvedValue(false),
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
    llmSaveApiKey.mockReset();
    llmHasStoredApiKey.mockReset();
    llmSaveApiKey.mockResolvedValue(DEFAULT_LLM_API_KEY_ID);
    llmHasStoredApiKey.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows unverified status when key ref exists but probe has not succeeded", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });

    render(<EnvLlmConfigPanel busy={false} />);

    await waitFor(() => {
      expect(screen.getByText(/尚未验证连通性/)).toBeTruthy();
    });
    expect(screen.queryByText(/连接就绪/)).toBeNull();
    expect(screen.queryByText(/连接已验证/)).toBeNull();
    expect(screen.getByText("待验证")).toBeTruthy();
  });

  it("shows verified status only after a successful probe", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    llmProbeConnection.mockResolvedValue({
      ok: true,
      message: "连接成功。",
      latency_ms: 42,
    });

    render(<EnvLlmConfigPanel busy={false} />);
    await waitFor(() => {
      expect(llmHasStoredApiKey).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "探测连接" }));

    await waitFor(() => {
      expect(screen.getByText(/连接已验证/)).toBeTruthy();
    });
    expect(screen.getByText("可用")).toBeTruthy();
  });

  it("hides verified hint after a failed probe", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    llmProbeConnection.mockResolvedValue({
      ok: false,
      status: 401,
      message: "认证失败（HTTP 401），请检查 API Key。",
    });

    render(<EnvLlmConfigPanel busy={false} />);
    await waitFor(() => {
      expect(llmHasStoredApiKey).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "探测连接" }));

    await waitFor(() => {
      expect(screen.getByText("认证失败（HTTP 401），请检查 API Key。")).toBeTruthy();
    });
    expect(screen.queryByText(/连接已验证/)).toBeNull();
  });

  it("probes with keychain id after save clears the input", async () => {
    llmProbeConnection.mockResolvedValue({
      ok: true,
      message: "连接成功。",
      latency_ms: 42,
    });

    render(<EnvLlmConfigPanel busy={false} />);
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "sk-test-key" },
    });
    const saveButton = screen.getAllByRole("button", { name: "保存配置" })[0];
    expect(saveButton).toBeDefined();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(llmSaveApiKey).toHaveBeenCalled();
    });

    const probeButton = screen.getAllByRole("button", { name: "探测连接" })[0];
    expect(probeButton).toBeDefined();
    fireEvent.click(probeButton);

    await waitFor(() => {
      expect(llmProbeConnection).toHaveBeenCalled();
    });
    const req = llmProbeConnection.mock.calls[0]?.[0] as {
      runtime?: { apiKey?: string; apiKeyId?: string };
    };
    expect(req.runtime?.apiKeyId).toBe(DEFAULT_LLM_API_KEY_ID);
    expect(req.runtime?.apiKey).toBeUndefined();
  });
});

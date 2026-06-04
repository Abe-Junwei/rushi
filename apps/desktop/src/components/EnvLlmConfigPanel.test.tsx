import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnvLlmConfigPanel } from "./EnvLlmConfigPanel";
import {
  DEFAULT_LLM_API_KEY_ID,
  LLM_STORAGE_KEYS,
  applyLlmProviderPreset,
  persistLlmRuntimeConfig,
} from "../services/postprocess/postprocessRuntimeContract";

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("../services/ui/toast", () => ({
  toast: {
    info: vi.fn(),
    success: (...args: unknown[]) => {
      toastSuccess(...args);
    },
    error: (...args: unknown[]) => {
      toastError(...args);
    },
    warning: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const llmProbeConnection = vi.fn<
  (req: unknown) => Promise<{ ok: boolean; message: string; status?: number; latency_ms?: number }>
>();
const llmSaveApiKey = vi.fn<(req: unknown) => Promise<string>>();
const llmHasStoredApiKey = vi.fn<(req: unknown) => Promise<boolean>>();
const ollamaDetectStatus = vi.fn<
  () => Promise<{ reachable: boolean; modelCount: number; hasQwen25_7b: boolean; message: string }>
>();

vi.mock("../tauri/postprocessApi", () => ({
  llmProbeConnection: (req: unknown) => llmProbeConnection(req),
  llmSaveApiKey: (req: unknown) => llmSaveApiKey(req),
  llmDeleteApiKey: vi.fn(),
  llmHasStoredApiKey: (req: unknown) => llmHasStoredApiKey(req),
  llmMigrateLegacyApiKey: vi.fn().mockResolvedValue(false),
  ollamaDetectStatus: () => ollamaDetectStatus(),
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
    toastError.mockReset();
    toastSuccess.mockReset();
    llmProbeConnection.mockReset();
    llmSaveApiKey.mockReset();
    llmHasStoredApiKey.mockReset();
    ollamaDetectStatus.mockReset();
    llmSaveApiKey.mockResolvedValue(DEFAULT_LLM_API_KEY_ID);
    llmHasStoredApiKey.mockResolvedValue(true);
    ollamaDetectStatus.mockResolvedValue({
      reachable: true,
      modelCount: 1,
      hasQwen25_7b: true,
      message: "Ollama 就绪",
    });
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
    expect(screen.queryByText(/API Key 已验证/)).toBeNull();
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
      expect(screen.getByText(/API Key 已验证/)).toBeTruthy();
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("shows toast on failed probe", async () => {
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
      expect(toastError).toHaveBeenCalledWith("认证失败（HTTP 401），请检查 API Key。");
    });
    expect(screen.queryByText(/API Key 已验证/)).toBeNull();
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

    const probeButton = screen.getByRole("button", { name: "探测连接" });
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

  it("shows LLM source switch; ollama banner only in local mode", async () => {
    render(<EnvLlmConfigPanel busy={false} />);
    expect(screen.getByRole("radio", { name: /本机 Ollama/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /云端 API/ })).toBeTruthy();
    expect(screen.queryByText(/本机 LLM（Ollama）/)).toBeNull();
    expect(screen.getByText(/云端 LLM/)).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /本机 Ollama/ }));
    await waitFor(() => {
      expect(screen.getByText(/本机 LLM（Ollama）/)).toBeTruthy();
    });
  });

  it("switching to local mode persists ollama preset", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    render(<EnvLlmConfigPanel busy={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /本机 Ollama/ }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("qwen2.5:7b")).toBeTruthy();
    });
    expect(localStorage.getItem(LLM_STORAGE_KEYS.providerId)).toBe("ollama");
  });

  it("switching to cloud mode restores last saved cloud provider", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("kimi"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    render(<EnvLlmConfigPanel busy={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /本机 Ollama/ }));
    await waitFor(() => {
      expect(localStorage.getItem(LLM_STORAGE_KEYS.providerId)).toBe("ollama");
    });
    fireEvent.click(screen.getByRole("radio", { name: /云端 API/ }));
    await waitFor(() => {
      expect(localStorage.getItem(LLM_STORAGE_KEYS.providerId)).toBe("kimi");
      expect(screen.getByText(/云端 LLM（Kimi/)).toBeTruthy();
    });
  });

  it("switching to cloud mode falls back to deepseek when no cloud snapshot exists", async () => {
    persistLlmRuntimeConfig(applyLlmProviderPreset("ollama"));
    render(<EnvLlmConfigPanel busy={false} />);
    await waitFor(() => {
      expect(screen.getByText(/本机 LLM（Ollama）/)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("radio", { name: /云端 API/ }));
    await waitFor(() => {
      expect(localStorage.getItem(LLM_STORAGE_KEYS.providerId)).toBe("deepseek");
      expect(screen.queryByText(/本机 LLM（Ollama）· 服务就绪/)).toBeNull();
      expect(screen.getByText(/云端 LLM（DeepSeek）/)).toBeTruthy();
    });
  });
});

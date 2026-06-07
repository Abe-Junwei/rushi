/**
 * Browser Playwright bootstrap: stub Tauri invoke + ASR /health fetch for Vite shell smoke.
 * Loaded via page.addInitScript before navigating to the desktop UI.
 */
(() => {
  const healthBody = {
    status: "ok",
    service: "rushi-asr",
    ffmpeg_ok: true,
    funasr_import_ok: true,
    funasr_model_configured: true,
    funasr_ready: false,
    funasr_required_models_cached: false,
    ready_for_transcribe: false,
    transcription_mode: "stub",
    funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    funasr_loaded_model_id: null,
    funasr_language: "zh",
    prepare_model_async: true,
  };

  const invokeHandlers = {
    project_list: async () => [],
    postprocess_get_config: async () => ({
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen2.5:7b",
      hasApiKey: false,
    }),
    postprocess_list_api_keys: async () => [],
    local_runtime_catalog: async () => ({ items: [] }),
    correction_memory_list: async () => [],
    correction_rules_list: async () => [],
    glossary_list: async () => [],
  };

  window.__TAURI__ = {};
  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: "main" },
    },
    convertFileSrc: (path) => path,
    transformCallback: () => 0,
    invoke: async (cmd, args) => {
      const handler = invokeHandlers[cmd];
      if (handler) return handler(args);
      return null;
    },
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/health")) {
      return new Response(JSON.stringify(healthBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/") && url.includes(":8741")) {
      return new Response(JSON.stringify({ service: "rushi-asr", prepare_model_async: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };
})();

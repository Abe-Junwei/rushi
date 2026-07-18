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

  const now = Date.now();
  const e2eProjectId = "proj-e2e-core";
  const e2eFileId = "file-e2e-core";
  const e2eSegment = {
    idx: 0,
    uid: "seg-e2e-1",
    start_sec: 0,
    end_sec: 2,
    text: "初始语段",
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
  };
  /** @type {Array<{ id: string; name: string; created_at_ms: number; updated_at_ms: number; file_count?: number }>} */
  let projectSummaries = [];
  let currentSegments = [e2eSegment];
  /** Kept in sync with create_empty_project so Hub list_files refresh matches UI title. */
  let currentProjectName = "未命名项目";
  /** @type {Array<{ cmd: string; args: unknown }>} */
  const invocations = [];

  const invokeHandlers = {
    project_list: async () => projectSummaries,
    project_load: async () => ({
      id: e2eProjectId,
      name: currentProjectName,
      files: [
        {
          id: e2eFileId,
          name: currentProjectName,
          file_type: "text",
          updated_at_ms: now,
        },
      ],
      created_at_ms: now,
      updated_at_ms: now,
    }),
    create_empty_project: async (args) => {
      currentProjectName = args?.name ?? "未命名项目";
      const detail = {
        id: e2eProjectId,
        name: currentProjectName,
        files: [
          {
            id: e2eFileId,
            name: currentProjectName,
            file_type: "text",
            updated_at_ms: now,
          },
        ],
        created_at_ms: now,
        updated_at_ms: now,
      };
      projectSummaries = [
        {
          id: detail.id,
          name: detail.name,
          created_at_ms: now,
          updated_at_ms: now,
          file_count: 1,
        },
      ];
      return detail;
    },
    list_files: async (args) => {
      const projectId = args?.projectId ?? e2eProjectId;
      if (projectId !== e2eProjectId) return [];
      return [
        {
          id: e2eFileId,
          name: currentProjectName,
          file_type: "text",
          updated_at_ms: now,
        },
      ];
    },
    load_file: async (args) => ({
      id: args?.fileId ?? e2eFileId,
      project_id: e2eProjectId,
      name: currentProjectName,
      file_type: "text",
      audio_path: null,
      segments: currentSegments,
      created_at_ms: now,
      updated_at_ms: now,
    }),
    file_save_segments: async (args) => {
      currentSegments = args?.segments ?? currentSegments;
    },
    export_text_file: async () => null,
    export_docx: async () => "/tmp/e2e.docx",
    ollama_detect_status: async () => ({
      reachable: false,
      modelCount: 0,
      hasQwen25_7b: false,
      message: "stub",
    }),
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
    seed_bundled_asr_models_if_needed: async () => ({
      status: "skipped_no_bundle",
      imported_bytes: 0,
      models_root: "",
      modelscope_cache: "",
      pack_version: 1,
      bundle_id: "e2e-mock",
      seeded_at: "",
    }),
    retry_bundled_asr_sidecar: async () => ({
      attempted: true,
      success: true,
      detail: "",
    }),
  };

  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: () => {},
  };

  window.__RUSHI_E2E_INVOKES__ = invocations;
  window.__RUSHI_E2E_SET_SEGMENTS__ = (segments) => {
    currentSegments = Array.isArray(segments) ? segments : currentSegments;
  };
  window.__TAURI__ = {};
  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: "main" },
    },
    convertFileSrc: (path) => path,
    transformCallback: () => 0,
    invoke: async (cmd, args) => {
      invocations.push({ cmd, args });
      if (cmd === "plugin:event|listen") {
        return 1;
      }
      if (cmd === "plugin:event|unlisten") {
        return null;
      }
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

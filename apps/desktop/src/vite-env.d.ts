/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASR_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by vitest.perf.config.ts when running perf gates on CI. */
declare const __PERF_CI__: boolean | undefined;

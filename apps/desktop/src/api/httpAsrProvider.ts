import type { TranscriptionProvider, TranscriptionResult } from "../contracts";
import { isTranscriptionResult } from "../contracts";
import { asrBaseUrl } from "../config/env";

function trimTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

function transcribeUrl(base: string): string {
  return `${trimTrailingSlashes(base)}/v1/transcribe`;
}

function formatHttpDetail(detail: unknown): string {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export function createHttpAsrProvider(baseUrl: string = asrBaseUrl()): TranscriptionProvider {
  const base = trimTrailingSlashes(baseUrl);
  return {
    id: `http-asr:${base}`,
    supportsHotwordBias: false,
    async isAvailable(): Promise<boolean> {
      try {
        const res = await fetch(`${base}/health`, { method: "GET", signal: AbortSignal.timeout(3000) });
        return res.ok;
      } catch {
        return false;
      }
    },
    async transcribeFile(file: File, signal?: AbortSignal): Promise<TranscriptionResult> {
      const body = new FormData();
      body.append("file", file, file.name);
      const res = await fetch(transcribeUrl(base), { method: "POST", body, signal });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json && typeof json === "object" && "detail" in json
            ? formatHttpDetail((json as { detail?: unknown }).detail)
            : res.statusText;
        throw new Error(`转写请求失败 HTTP ${res.status}: ${msg}`);
      }
      if (!isTranscriptionResult(json)) {
        throw new Error("转写响应不符合 TranscriptionResult 契约");
      }
      return json;
    },
  };
}

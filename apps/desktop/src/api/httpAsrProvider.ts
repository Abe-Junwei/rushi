import type { TranscriptionProvider, TranscriptionResult } from "../contracts";
import { isTranscriptionResult } from "../contracts";
import { asrBaseUrl } from "../config/env";

function transcribeUrl(base: string): string {
  return `${base.replace(/\/$/, "")}/v1/transcribe`;
}

export function createHttpAsrProvider(baseUrl: string = asrBaseUrl()): TranscriptionProvider {
  const base = baseUrl.replace(/\/$/, "");
  return {
    id: `http-asr:${base}`,
    async transcribeFile(file: File, signal?: AbortSignal): Promise<TranscriptionResult> {
      const body = new FormData();
      body.append("file", file, file.name);
      const res = await fetch(transcribeUrl(base), { method: "POST", body, signal });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json && typeof json === "object" && "detail" in json
            ? String((json as { detail?: unknown }).detail)
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

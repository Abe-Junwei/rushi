import { invoke } from "@tauri-apps/api/core";
import type { PostprocessRuntimeBridge } from "../services/postprocess/postprocessRuntimeContract";
import { computeSingleTextDiff, type TextDiffSpan } from "../utils/textDiff";

export interface PostprocessAutoPunctuateRequest {
  task: "auto_punctuate";
  request_id?: string;
  segment_uid: string;
  text: string;
  neighbor_snippets?: string[];
  /** 设置页 DeepSeek / Kimi 配置；有则优先于环境变量。 */
  runtime?: PostprocessRuntimeBridge;
}

interface PostprocessAutoPunctuateRawResponse {
  text: string;
  provider: string;
  latency_ms: number;
}

export interface PostprocessAutoPunctuateResponse {
  text: string;
  diff: TextDiffSpan[];
  provider: string;
  latency_ms: number;
}

type LlmApiKeyRequest = {
  api_key_id?: string;
  api_key: string;
};

type LlmDeleteApiKeyRequest = {
  api_key_id?: string;
};

export type LlmProbeConnectionRequest = {
  runtime: PostprocessRuntimeBridge;
};

export type LlmProbeConnectionResponse = {
  ok: boolean;
  status?: number;
  message: string;
  latency_ms?: number;
};

export async function postprocessAutoPunctuate(
  req: PostprocessAutoPunctuateRequest,
): Promise<PostprocessAutoPunctuateResponse> {
  const out = await invoke<PostprocessAutoPunctuateRawResponse>(
    "postprocess_auto_punctuate",
    { req },
  );
  return {
    ...out,
    diff: computeSingleTextDiff(req.text, out.text),
  };
}

export async function postprocessCancelAutoPunctuate(requestId: string): Promise<boolean> {
  return await invoke<boolean>("postprocess_cancel_auto_punctuate", {
    req: { request_id: requestId },
  });
}

export async function llmSaveApiKey(req: LlmApiKeyRequest): Promise<string> {
  return await invoke<string>("llm_save_api_key", { req });
}

export async function llmDeleteApiKey(req: LlmDeleteApiKeyRequest): Promise<void> {
  await invoke("llm_delete_api_key", { req });
}

export async function llmProbeConnection(
  req: LlmProbeConnectionRequest,
): Promise<LlmProbeConnectionResponse> {
  return await invoke<LlmProbeConnectionResponse>("llm_probe_connection", { req });
}

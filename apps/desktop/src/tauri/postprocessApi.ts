import { invoke } from "@tauri-apps/api/core";
import type { NeighborContextItem } from "../pages/autoPunctuateNeighbors";
import type { PostprocessRuntimeBridge } from "../services/postprocess/postprocessRuntimeContract";
import { computeSingleTextDiff, type TextDiffSpan } from "../utils/textDiff";

export type { NeighborContextItem };

export interface PostprocessAutoPunctuateRequest {
  task: "auto_punctuate";
  request_id?: string;
  segment_uid: string;
  text: string;
  /** @deprecated 使用 neighbor_context（R3t-C） */
  neighbor_snippets?: string[];
  neighbor_context?: NeighborContextItem[];
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
  apiKeyId?: string;
  apiKey: string;
};

type LlmDeleteApiKeyRequest = {
  apiKeyId?: string;
};

export type LlmProbeConnectionRequest = {
  runtime: PostprocessRuntimeBridge;
};

export type LlmProbeConnectionResponse = {
  ok: boolean;
  status?: number;
  message: string;
  latency_ms?: number;
  /** `chat_completion_ping` | `models_list` */
  probeMethod?: string;
  endpoint?: string;
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

export type RefineSegmentItem = {
  uid: string;
  startSec: number;
  endSec: number;
  text: string;
};

export type SegmentRefineOp =
  | { op: "update_text"; uid: string; text: string }
  | { op: "merge"; uids: string[] }
  | { op: "split"; uid: string; at_sec: number; left_text: string; right_text: string };

export interface PostprocessRefineSegmentsRequest {
  task: "refine_segments";
  request_id?: string;
  segments: RefineSegmentItem[];
  runtime?: PostprocessRuntimeBridge;
}

export interface PostprocessRefineSegmentsResponse {
  ops: SegmentRefineOp[];
  rationale?: string;
  provider: string;
  latencyMs: number;
  /** @deprecated Tauri camelCase; prefer latencyMs */
  latency_ms?: number;
}

export async function postprocessRefineSegments(
  req: PostprocessRefineSegmentsRequest,
): Promise<PostprocessRefineSegmentsResponse> {
  return await invoke<PostprocessRefineSegmentsResponse>("postprocess_refine_segments", { req });
}

export interface PostprocessExportPolishRequest {
  task: "export_polish";
  requestId?: string;
  body: string;
  runtime: PostprocessRuntimeBridge;
  ruleHints?: string;
}

export interface PostprocessExportPolishResponse {
  /** 与语段一一对应，仅标点/空格（输入已为规则校正稿）。 */
  punctLines: string[];
  breakAfterLine: number[];
  provider: string;
  latency_ms: number;
}

export async function postprocessExportPolish(
  req: PostprocessExportPolishRequest,
): Promise<PostprocessExportPolishResponse> {
  return invoke<PostprocessExportPolishResponse>("postprocess_export_polish", { req });
}

export async function postprocessCancelExportPolish(requestId: string): Promise<boolean> {
  return invoke<boolean>("postprocess_cancel_export_polish", {
    req: { request_id: requestId },
  });
}

export { correctionAcceptRule } from "./correctionApi";

export async function llmSaveApiKey(req: LlmApiKeyRequest): Promise<string> {
  return await invoke<string>("llm_save_api_key", { req });
}

export async function llmHasStoredApiKey(req: { apiKeyId?: string }): Promise<boolean> {
  return await invoke<boolean>("llm_has_stored_api_key", { req });
}

export async function llmDeleteApiKey(req: LlmDeleteApiKeyRequest): Promise<void> {
  await invoke("llm_delete_api_key", { req });
}

export async function llmMigrateLegacyApiKey(req: { legacyApiKeyId: string }): Promise<boolean> {
  return await invoke<boolean>("llm_migrate_legacy_api_key", { req });
}

export async function llmProbeConnection(
  req: LlmProbeConnectionRequest,
): Promise<LlmProbeConnectionResponse> {
  return await invoke<LlmProbeConnectionResponse>("llm_probe_connection", { req });
}

export type OllamaDetectResponse = {
  reachable: boolean;
  modelCount: number;
  hasQwen25_7b: boolean;
  /** 传入 model 时：该 ID 是否在 Ollama tags 中 */
  hasConfiguredModel?: boolean;
  message: string;
};

export async function ollamaDetectStatus(options?: {
  tagsUrl?: string;
  model?: string;
}): Promise<OllamaDetectResponse> {
  const req: { tagsUrl?: string; model?: string } = {};
  if (options?.tagsUrl) req.tagsUrl = options.tagsUrl;
  if (options?.model?.trim()) req.model = options.model.trim();
  return await invoke<OllamaDetectResponse>("ollama_detect_status", { req });
}

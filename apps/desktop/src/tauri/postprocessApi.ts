import { invoke } from "@tauri-apps/api/core";
import type { PostprocessRuntimeBridge } from "../services/postprocess/postprocessRuntimeContract";
import { computeSingleTextDiff, type TextDiffSpan } from "../utils/textDiff";

export interface PostprocessAutoPunctuateRequest {
  task: "auto_punctuate";
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

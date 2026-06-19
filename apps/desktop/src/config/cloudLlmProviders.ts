import type { LlmProviderId } from "../services/postprocess/postprocessRuntimeContract";

export function cloudLlmProviderIds(): LlmProviderId[] {
  return ["deepseek", "kimi", "qwen", "siliconflow", "doubao", "openai", "openrouter"];
}

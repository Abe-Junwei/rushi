export type EnvironmentFocusSection = "local-asr" | "online-stt" | "llm";

/** Which settings nav section wins when multiple focus seq counters are set. */
export function resolveEnvironmentFocusSection(input: {
  focusLocalAsrSeq: number;
  focusOnlineSttSeq: number;
  focusLlmSeq: number;
}): EnvironmentFocusSection | null {
  const { focusLocalAsrSeq, focusOnlineSttSeq, focusLlmSeq } = input;
  if (focusLocalAsrSeq > 0) return "local-asr";
  if (focusOnlineSttSeq > 0) return "online-stt";
  if (focusLlmSeq > 0) return "llm";
  return null;
}

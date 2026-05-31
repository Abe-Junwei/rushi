import type { SegmentDto } from "../tauri/projectApi";

export const AUTO_PUNCTUATE_NEIGHBOR_SNIPPET_MAX = 80;

export type NeighborContextRole = "prev" | "next";

export type NeighborContextItem = {
  role: NeighborContextRole;
  text: string;
};

function truncateSnippet(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= AUTO_PUNCTUATE_NEIGHBOR_SNIPPET_MAX) return trimmed;
  return `${trimmed.slice(0, AUTO_PUNCTUATE_NEIGHBOR_SNIPPET_MAX)}…`;
}

/** R3t-C：前 1 + 后 1 邻段摘录（仅非空正文）。 */
export function collectAutoPunctuateNeighborContext(
  segments: SegmentDto[],
  selectedIdx: number,
): NeighborContextItem[] {
  const out: NeighborContextItem[] = [];
  const prev = segments[selectedIdx - 1]?.text?.trim();
  const next = segments[selectedIdx + 1]?.text?.trim();
  if (prev) {
    out.push({ role: "prev", text: truncateSnippet(prev) });
  }
  if (next) {
    out.push({ role: "next", text: truncateSnippet(next) });
  }
  return out;
}

export function neighborContextSummary(items: NeighborContextItem[]): string | null {
  if (items.length === 0) return null;
  const parts: string[] = [];
  if (items.some((item) => item.role === "prev")) parts.push("上一语段");
  if (items.some((item) => item.role === "next")) parts.push("下一语段");
  return `含邻段上下文（${parts.join("、")}）`;
}

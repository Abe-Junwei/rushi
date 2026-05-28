import { asrHealthUrl } from "../../config/env";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import { parseAsrHealthJson } from "../../pages/useAsrBridgeController";
import { loopbackFetch } from "./loopbackFetch";

/** Loopback GET /health → parsed caps (shared by setup flow). */
export async function fetchAsrHealthCaps(): Promise<AsrHealthCapabilities | null> {
  try {
    const res = await loopbackFetch(asrHealthUrl(), {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json().catch(() => null);
    return parseAsrHealthJson(data);
  } catch {
    return null;
  }
}

export type PollLoopbackHealthOptions = {
  deadlineMs?: number;
  intervalMs?: number;
  predicate?: (caps: AsrHealthCapabilities) => boolean;
};

/** Poll loopback /health until predicate passes or deadline (model switch / restart recovery). */
export async function pollLoopbackHealthUntil(
  options?: PollLoopbackHealthOptions,
): Promise<AsrHealthCapabilities | null> {
  const deadlineMs = options?.deadlineMs ?? 90_000;
  const intervalMs = options?.intervalMs ?? 1_000;
  const predicate = options?.predicate ?? ((c) => c.funasr_ready === true);
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const caps = await fetchAsrHealthCaps();
    if (caps && predicate(caps)) {
      return caps;
    }
    await new Promise<void>((r) => setTimeout(r, intervalMs));
  }
  return fetchAsrHealthCaps();
}

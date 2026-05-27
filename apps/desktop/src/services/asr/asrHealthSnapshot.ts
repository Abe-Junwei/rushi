import { asrHealthUrl } from "../../config/env";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import { parseAsrHealthJson } from "../../pages/useAsrBridgeController";

/** Loopback GET /health → parsed caps (shared by setup flow). */
export async function fetchAsrHealthCaps(): Promise<AsrHealthCapabilities | null> {
  try {
    const res = await fetch(asrHealthUrl(), { method: "GET", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data: unknown = await res.json().catch(() => null);
    return parseAsrHealthJson(data);
  } catch {
    return null;
  }
}

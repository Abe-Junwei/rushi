import { asrBaseUrl } from "../../config/env";
import { loopbackFetch } from "./loopbackFetch";

export type AsrModelUnloadResult = {
  status: string;
  funasr_loaded_model_id: string | null;
  funasr_model_id: string | null;
};

/** Drop FunASR weights from sidecar RAM; failures are logged and swallowed. */
export async function postAsrModelUnload(): Promise<AsrModelUnloadResult | null> {
  try {
    const res = await loopbackFetch(`${asrBaseUrl()}/v1/models/unload`, {
      method: "POST",
      body: JSON.stringify({}),
      loopbackTimeoutMs: 8_000,
    });
    if (!res.ok) {
      console.warn("[asr] model unload failed", res.status);
      return null;
    }
    return (await res.json()) as AsrModelUnloadResult;
  } catch (error) {
    console.warn("[asr] model unload error", error);
    return null;
  }
}

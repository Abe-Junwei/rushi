import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../../config/env";
import { logRuntimeParity } from "../runtimeParity";

type ScopedWaveformFileMeta = { diskBytes: number };

/** Compare disk size vs WebView fetch(asset://) — diagnose release truncation without bypassing asset. */
export async function probeWaveformAssetFetchParity(
  label: string,
  diskPath: string | null | undefined,
  assetUrl: string | null | undefined,
): Promise<void> {
  if (!diskPath || !assetUrl || !isTauriRuntime()) return;
  try {
    const meta = await invoke<ScopedWaveformFileMeta>("scoped_waveform_file_meta", {
      path: diskPath,
    });
    const res = await fetch(assetUrl);
    if (!res.ok) {
      logRuntimeParity(
        "waveform",
        `asset_fetch_parity label=${label} disk=${meta.diskBytes} fetch_status=${res.status}`,
        "WARN",
      );
      return;
    }
    const buf = await res.arrayBuffer();
    const fetched = buf.byteLength;
    const disk = meta.diskBytes;
    const ratio = disk > 0 ? fetched / disk : 0;
    const level = fetched + 64 < disk ? "WARN" : "INFO";
    logRuntimeParity(
      "waveform",
      `asset_fetch_parity label=${label} disk=${disk} fetched=${fetched} ratio=${ratio.toFixed(4)}`,
      level,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logRuntimeParity("waveform", `asset_fetch_parity label=${label} err=${msg.slice(0, 120)}`, "WARN");
  }
}

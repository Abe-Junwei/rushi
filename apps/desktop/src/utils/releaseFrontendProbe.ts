import { isTauriRuntime } from "../config/env";
import { logRuntimeParity } from "../services/runtimeParity";
import {
  readTauriStyleCspNonce,
  TAURI_STYLE_CSP_NONCE_PROBE_ID,
  TAURI_STYLE_NONCE_TOKEN,
} from "./tauriStyleCspNonce";

function readProbeNonceState(probe: HTMLElement | null): "no-probe" | "placeholder" | "runtime" {
  if (!probe) return "no-probe";
  const nonce =
    probe.nonce?.trim() || probe.getAttribute("nonce")?.trim() || "";
  if (!nonce || nonce === TAURI_STYLE_NONCE_TOKEN) {
    return nonce === TAURI_STYLE_NONCE_TOKEN ? "placeholder" : "no-probe";
  }
  return "runtime";
}

/** Log embedded frontend bundle id + CSP nonce (no DevTools needed — see App Data logs/desktop.log). */
export function logReleaseFrontendProbe(): void {
  if (!isTauriRuntime()) return;

  const scriptSrc =
    document.querySelector('script[type="module"][src*="assets/index-"]')?.getAttribute("src") ??
    "(dev-inline)";

  const probe = document.getElementById(TAURI_STYLE_CSP_NONCE_PROBE_ID);
  const probeState = readProbeNonceState(probe);

  logRuntimeParity(
    "csp",
    `style_nonce=${readTauriStyleCspNonce() ? "present" : "missing"} probe=${probeState}`,
  );
  logRuntimeParity("startup", `bundle=${scriptSrc}`);
}

/** After editor mounts, log whether static segment-row layout rules are active. */
export function logSegmentRowLayoutProbe(): void {
  if (!isTauriRuntime()) return;

  const row = document.querySelector<HTMLElement>("[data-seg-row].seg-row-shell");
  if (!row) return;

  const style = getComputedStyle(row);
  logRuntimeParity(
    "editor",
    `seg_row display=${style.display} align=${style.alignItems} minHeight=${style.minHeight}`,
  );

  const textBody = row.querySelector<HTMLElement>(".segment-row-text-body");
  if (textBody) {
    const bodyStyle = getComputedStyle(textBody);
    logRuntimeParity(
      "editor",
      `seg_text_body flex=${bodyStyle.flex} minWidth=${bodyStyle.minWidth}`,
    );
  }
}

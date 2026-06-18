/** Matches `tauri-utils` `STYLE_NONCE_TOKEN`; replaced at runtime when Tauri serves HTML. */
export const TAURI_STYLE_NONCE_TOKEN = "__TAURI_STYLE_NONCE__";

export const TAURI_STYLE_CSP_NONCE_PROBE_ID = "rushi-tauri-style-csp-nonce";

function isRuntimeStyleNonce(value: string | null | undefined): value is string {
  const nonce = value?.trim();
  return Boolean(nonce && nonce !== TAURI_STYLE_NONCE_TOKEN);
}

/** Read nonce from an element (IDL first — getAttribute is empty under CSP nonce hiding). */
function readElementStyleNonce(element: Element): string | undefined {
  const fromIdl = (element as HTMLElement).nonce?.trim();
  if (isRuntimeStyleNonce(fromIdl)) return fromIdl;
  const fromAttr = element.getAttribute("nonce")?.trim();
  if (isRuntimeStyleNonce(fromAttr)) return fromAttr;
  return undefined;
}

function readNonceFromCspMetaContent(): string | undefined {
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy" i]');
  const content = meta?.getAttribute("content") ?? "";
  const match = content.match(/'nonce-([^']+)'/);
  const nonce = match?.[1]?.trim();
  return isRuntimeStyleNonce(nonce) ? nonce : undefined;
}

/** Read Tauri-injected style CSP nonce for libraries that inject `<style>` (e.g. WaveSurfer shadow DOM). */
export function readTauriStyleCspNonce(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const probe = document.getElementById(TAURI_STYLE_CSP_NONCE_PROBE_ID);
  if (probe) {
    const fromProbe = readElementStyleNonce(probe);
    if (fromProbe) return fromProbe;
  }
  const fromMeta = readNonceFromCspMetaContent();
  if (fromMeta) return fromMeta;
  for (const el of document.head.querySelectorAll("style[nonce], link[rel='stylesheet'][nonce]")) {
    const nonce = readElementStyleNonce(el);
    if (nonce) return nonce;
  }
  return undefined;
}

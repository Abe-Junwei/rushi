import WaveSurfer from "wavesurfer.js";
import { readTauriStyleCspNonce } from "./tauriStyleCspNonce";

/** Ensure WaveSurfer shadow-root `<style>` carries a CSP nonce (belt-and-suspenders after create). */
export function applyWaveSurferShadowCspNonce(
  container: HTMLElement | null | undefined,
  cspNonce?: string,
): void {
  const nonce = cspNonce ?? readTauriStyleCspNonce();
  if (!nonce || !container) return;
  const host = container.firstElementChild as HTMLElement | null;
  const shadow = host?.shadowRoot;
  const style = shadow?.querySelector("style");
  if (!style || style.nonce === nonce) return;
  style.nonce = nonce;
}

function resolveWaveSurferCspNonce(): string | undefined {
  return readTauriStyleCspNonce();
}

export type WaveSurferCreateOptions = Parameters<typeof WaveSurfer.create>[0];

export function withWaveSurferCspNonce(
  options: WaveSurferCreateOptions,
): WaveSurferCreateOptions {
  const cspNonce = resolveWaveSurferCspNonce();
  if (!cspNonce) return options;
  return { ...options, cspNonce };
}

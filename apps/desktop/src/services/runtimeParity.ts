import { logDesktopUi } from "./desktopUiLog";

/** Cross-cutting dev/release observability — same code path, log when behavior branch differs. */
export type RuntimeParityDomain =
  | "asr"
  | "asset"
  | "bundle"
  | "copy"
  | "csp"
  | "editor"
  | "export"
  | "network"
  | "performance"
  | "permissions"
  | "project"
  | "security"
  | "startup"
  | "transcribe"
  | "waveform"
  | "waveform_mount";

export function logRuntimeParity(
  domain: RuntimeParityDomain,
  message: string,
  level: "INFO" | "WARN" | "ERROR" = "INFO",
): void {
  logDesktopUi(level, `parity ${domain}: ${message}`);
}

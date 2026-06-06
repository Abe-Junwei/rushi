import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../config/env";

/** Release-friendly UI diagnostics → App Data logs/desktop.log */
export function logDesktopUi(level: "INFO" | "WARN" | "ERROR", message: string): void {
  if (!isTauriRuntime()) return;
  void invoke("ui_desktop_log", { level, message }).catch(() => {});
}

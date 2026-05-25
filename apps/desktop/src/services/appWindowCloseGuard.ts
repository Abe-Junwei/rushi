import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "../config/env";

export type AppWindowCloseGuardBridge = {
  hasUnsaved: () => boolean;
  onBlocked: () => void;
  isClosingAfterSave: () => boolean;
};

let bridge: AppWindowCloseGuardBridge | null = null;
let registerPromise: Promise<void> | null = null;

export function setAppWindowCloseGuardBridge(next: AppWindowCloseGuardBridge | null): void {
  bridge = next;
}

/** 应用启动时注册一次；关窗回调通过 bridge 读取最新逻辑，避免 effect 反复卸载监听。 */
export function ensureAppWindowCloseGuardRegistered(): void {
  if (!isTauriRuntime()) return;
  if (registerPromise) return;
  registerPromise = getCurrentWindow()
    .onCloseRequested((event) => {
      try {
        const b = bridge;
        if (!b) return;
        if (b.isClosingAfterSave()) return;
        if (!b.hasUnsaved()) return;
        event.preventDefault();
        b.onBlocked();
      } catch (e) {
        console.error("[appWindowCloseGuard] close handler failed", e);
      }
    })
    .then(() => undefined)
    .catch((e) => {
      registerPromise = null;
      console.error("[appWindowCloseGuard] failed to register onCloseRequested", e);
    });
}

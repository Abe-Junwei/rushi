import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauriRuntime } from "../config/env";

/** OTA 链起点：v0.1.1 须手动首装 v0.1.2（见 rel-mac-ota-intent）。 */
export const APP_UPDATE_OTA_BASELINE_VERSION = "0.1.2";

export type AppUpdateCheckResult =
  | { kind: "unsupported" }
  | { kind: "upToDate" }
  | { kind: "available"; update: Update; version: string; notes?: string }
  | { kind: "error"; message: string };

export function compareSemver(a: string, b: string): number {
  const parse = (raw: string): number[] => {
    const core = raw.trim().replace(/^v/i, "").split("+")[0]?.split("-")[0] ?? "";
    const parts = core.split(".").map((part) => Number.parseInt(part, 10));
    while (parts.length < 3) parts.push(0);
    return parts.slice(0, 3).map((n) => (Number.isFinite(n) ? n : 0));
  };
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i += 1) {
    const leftPart = left[i];
    const rightPart = right[i];
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

export function isAppUpdateSupportedForVersion(appVersion: string): boolean {
  return compareSemver(appVersion, APP_UPDATE_OTA_BASELINE_VERSION) >= 0;
}

export function mapAppUpdateError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes("signature") || lower.includes("sign")) {
    return "更新包验签失败，已拒绝安装。请从 GitHub Release 手动下载安装。";
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timeout") ||
    lower.includes("connection")
  ) {
    return "无法连接更新服务器，请检查网络后重试。";
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return "未找到更新清单，请稍后再试或从 GitHub Release 手动下载。";
  }
  return raw.trim() || "检查更新失败，请稍后再试。";
}

export async function checkForAppUpdate(appVersion: string): Promise<AppUpdateCheckResult> {
  if (!isTauriRuntime()) return { kind: "unsupported" };
  if (!isAppUpdateSupportedForVersion(appVersion)) return { kind: "unsupported" };
  try {
    const update = await check({ timeout: 30_000 });
    if (!update) return { kind: "upToDate" };
    return {
      kind: "available",
      update,
      version: update.version,
      notes: update.body ?? undefined,
    };
  } catch (error) {
    return { kind: "error", message: mapAppUpdateError(error) };
  }
}

export async function downloadAndInstallAppUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}

export function appUpdateUnsupportedMessage(): string {
  return `当前版本不支持应用内更新。请从 GitHub Release 手动安装 ${APP_UPDATE_OTA_BASELINE_VERSION} 或更高版本后再使用「检查更新」。`;
}

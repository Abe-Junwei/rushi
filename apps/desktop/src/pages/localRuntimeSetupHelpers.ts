import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import { packagedOrDev } from "../services/packagedUserHints";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retainedCurrentVersionMessage(diag: LocalRuntimeDiagnose | null | undefined): string | null {
  if (!diag || diag.install.phase !== "error" || diag.installed.status !== "installed") {
    return null;
  }
  const currentVersion = diag.installed.version ? `（${diag.installed.version}）` : "";
  const targetVersion = diag.availableVersion ? `到 ${diag.availableVersion}` : "到新版本";
  return `升级${targetVersion}失败，已保留当前版本${currentVersion}。`;
}

export function localRuntimeDevReloadHint(): string {
  return packagedOrDev(
    "若刚更新桌面端代码，请完全退出并重新运行 desktop:dev 后再试。",
    "若刚更新应用，请完全退出后重新打开；仍失败请重新安装最新版本。",
  );
}

export function describeLocalRuntimeActionError(action: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `${action}失败：${detail}。${localRuntimeDevReloadHint()}`;
}

export function missingRuntimeDiagnoseMessage(): string {
  return `无法读取应用内侧车状态。${localRuntimeDevReloadHint()}`;
}

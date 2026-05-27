import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";

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

export const LOCAL_RUNTIME_DEV_RELOAD_HINT =
  "若刚更新桌面端代码，请完全退出并重新运行 desktop:dev 后再试。";

export function describeLocalRuntimeActionError(action: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `${action}失败：${detail}。${LOCAL_RUNTIME_DEV_RELOAD_HINT}`;
}

export function missingRuntimeDiagnoseMessage(): string {
  return `无法读取应用内侧车状态。${LOCAL_RUNTIME_DEV_RELOAD_HINT}`;
}

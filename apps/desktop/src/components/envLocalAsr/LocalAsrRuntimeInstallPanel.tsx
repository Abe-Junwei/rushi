import { CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { formatDiskFree } from "../../services/asr/asrSetupContract";
import {
  isLocalRuntimeInstallRunning,
  isLocalRuntimeManifestInstallBlocked,
  type LocalRuntimeDiagnose,
} from "../../services/localRuntime/localRuntimeContract";

type Props = {
  localRuntimeDiag: LocalRuntimeDiagnose;
  wizardBusy: boolean;
  downloadLocalRuntime: () => Promise<void>;
  cancelLocalRuntime: () => Promise<void>;
  refreshLocalRuntimeDiagnose: () => Promise<unknown>;
  revalidateLocalRuntime: () => Promise<void>;
  clearLocalRuntime: () => Promise<void>;
  restorePreviousLocalRuntime: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
};

export function LocalAsrRuntimeInstallPanel({
  localRuntimeDiag,
  wizardBusy,
  downloadLocalRuntime,
  cancelLocalRuntime,
  refreshLocalRuntimeDiagnose,
  revalidateLocalRuntime,
  clearLocalRuntime,
  restorePreviousLocalRuntime,
  openAppDataFolder,
  exportDiagnosticBundle,
}: Props) {
  const runtimeInstallRunning = isLocalRuntimeInstallRunning(localRuntimeDiag.install.phase);
  const retainedCurrentAfterInstallError =
    localRuntimeDiag.install.phase === "error" && localRuntimeDiag.installed.status === "installed";
  const manifestInstallBlocked = isLocalRuntimeManifestInstallBlocked(localRuntimeDiag);
  const updateAvailable =
    !!localRuntimeDiag.availableVersion &&
    !!localRuntimeDiag.installed.version &&
    localRuntimeDiag.availableVersion !== localRuntimeDiag.installed.version;

  return (
    <div className="rounded bg-notion-callout-bg px-3 py-2 text-[12px] text-notion-text-muted">
      <p className="font-medium text-notion-text">应用内侧车运行时</p>
      <p className="mt-1">
        {runtimeInstallRunning
          ? localRuntimeDiag.install.message
          : retainedCurrentAfterInstallError
            ? (localRuntimeDiag.blockingIssue ??
              `升级失败，已保留当前版本${localRuntimeDiag.installed.version ? `（${localRuntimeDiag.installed.version}）` : ""}`)
            : localRuntimeDiag.installed.status === "corrupt"
              ? (localRuntimeDiag.installed.detail ?? "已安装组件损坏，请重新下载或恢复上一版本。")
              : localRuntimeDiag.installed.status === "installed"
                ? `已安装${localRuntimeDiag.installed.version ? `（${localRuntimeDiag.installed.version}）` : ""}`
                : (localRuntimeDiag.blockingIssue ?? "尚未安装。")}
      </p>
      {localRuntimeDiag.availableVersion ? (
        <p className="mt-1 text-[11px] text-notion-text-muted">
          manifest 可用版本：{localRuntimeDiag.availableVersion}
        </p>
      ) : null}
      {updateAvailable ? (
        <p className="mt-1 text-[11px] text-zen-saffron">
          当前版本 {localRuntimeDiag.installed.version} 落后于 manifest 可用版本，可下载新组件；若升级失败可恢复上一版。
        </p>
      ) : null}
      {localRuntimeDiag.requiredDiskBytes ? (
        <p className="mt-1 text-[11px] text-notion-text-muted">
          安装预算约 {formatDiskFree(localRuntimeDiag.requiredDiskBytes)}
          {localRuntimeDiag.freeDiskBytes != null
            ? `，当前可用空间约 ${formatDiskFree(localRuntimeDiag.freeDiskBytes)}`
            : ""}
        </p>
      ) : null}
      {localRuntimeDiag.manifestSignatureKeyId ? (
        <p className="mt-1 text-[11px] text-notion-text-muted">
          manifest 签名 key：{localRuntimeDiag.manifestSignatureKeyId}
        </p>
      ) : null}
      {localRuntimeDiag.manifestIssue ? (
        <p className="mt-2 rounded bg-zen-cinnabar/10 px-2 py-1 text-[11px] text-zen-cinnabar">
          {localRuntimeDiag.installed.status === "installed"
            ? `当前已安装版本仍可继续使用，但下载/升级已被阻止：${localRuntimeDiag.manifestIssue}`
            : localRuntimeDiag.manifestIssue}
        </p>
      ) : null}
      {localRuntimeDiag.installed.previousVersion ? (
        <p className="mt-1 text-[11px] text-notion-text-muted">
          可恢复上一版本：{localRuntimeDiag.installed.previousVersion}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={wizardBusy || runtimeInstallRunning || manifestInstallBlocked}
          onClick={() => void downloadLocalRuntime()}
        >
          下载 / 修复语音识别组件
        </button>
        {runtimeInstallRunning ? (
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={wizardBusy}
            onClick={() => void cancelLocalRuntime()}
          >
            取消当前操作
          </button>
        ) : null}
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={wizardBusy}
          onClick={() => void refreshLocalRuntimeDiagnose()}
        >
          刷新组件状态
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={wizardBusy || runtimeInstallRunning || !localRuntimeDiag.installed.executablePath}
          onClick={() => void revalidateLocalRuntime()}
        >
          重新验证安装
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={wizardBusy || runtimeInstallRunning || localRuntimeDiag.installed.status === "missing"}
          onClick={() => void clearLocalRuntime()}
        >
          清除已安装组件
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={wizardBusy || runtimeInstallRunning || !localRuntimeDiag.installed.previousVersion}
          onClick={() => void restorePreviousLocalRuntime()}
        >
          恢复上一版本
        </button>
        <button type="button" className={CONTROL_BTN_SECONDARY} disabled={wizardBusy} onClick={() => void openAppDataFolder()}>
          打开应用数据目录
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={wizardBusy}
          onClick={() => void exportDiagnosticBundle()}
        >
          导出诊断包
        </button>
      </div>
      {localRuntimeDiag.installed.lastVerifyError ? (
        <p className="mt-2 rounded bg-zen-cinnabar/10 px-2 py-1 text-[11px] text-zen-cinnabar">
          最近一次验证失败：{localRuntimeDiag.installed.lastVerifyError}
        </p>
      ) : null}
      {retainedCurrentAfterInstallError && localRuntimeDiag.install.error ? (
        <p className="mt-2 rounded bg-zen-cinnabar/10 px-2 py-1 text-[11px] text-zen-cinnabar">
          升级未生效，当前仍使用 {localRuntimeDiag.installed.version ?? "已安装版本"}；请使用上方诊断说明、重新验证或导出诊断包继续排查。
        </p>
      ) : null}
    </div>
  );
}

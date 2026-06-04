import { formatDiskFree, type AsrSetupReport } from "./asrSetupContract";
import {
  isLocalRuntimeInstallRunning,
  isLocalRuntimeManifestInstallBlocked,
  type LocalRuntimeDiagnose,
} from "../localRuntime/localRuntimeContract";

export type RuntimeInstallPresentation = {
  shortStatus: string;
  statusLine: string;
  supplementalLines: string[];
  alertLine: string | null;
  needsAttention: boolean;
  manifestInstallBlocked: boolean;
  runtimeInstallRunning: boolean;
  /** manifest 阻断时隐藏「下载 / 修复」，改展示手动安装引导。 */
  showDownloadAction: boolean;
};

const MANIFEST_BLOCKED_MISSING_STATUS = "尚未安装 · 应用内下载不可用";

const MANIFEST_BLOCKED_DEV_HINT =
  "开发环境可在「环境与维护 → 高级诊断」查看手动命令，或在 services/asr 目录运行 python -m rushi_asr。";

export function buildDiskMetaLine(report: AsrSetupReport | null): string | null {
  if (!report?.diskFreeBytes) return null;
  return `模型目录可用 ${formatDiskFree(report.diskFreeBytes)}${report.diskLow ? "（偏低）" : ""}`;
}

export function buildRuntimeInstallPresentation(diag: LocalRuntimeDiagnose): RuntimeInstallPresentation {
  const runtimeInstallRunning = isLocalRuntimeInstallRunning(diag.install.phase);
  const retainedCurrentAfterInstallError =
    diag.install.phase === "error" && diag.installed.status === "installed";
  const manifestInstallBlocked = isLocalRuntimeManifestInstallBlocked(diag);
  const updateAvailable =
    !!diag.availableVersion &&
    !!diag.installed.version &&
    diag.availableVersion !== diag.installed.version;

  const manifestDetail = diag.manifestIssue ?? diag.blockingIssue;

  const statusLine = runtimeInstallRunning
    ? diag.install.message
    : retainedCurrentAfterInstallError
      ? (diag.blockingIssue ?? `升级失败，仍保留 ${diag.installed.version ?? "当前版本"}`)
      : diag.installed.status === "corrupt"
        ? (diag.installed.detail ?? "组件损坏，请下载 / 修复或恢复上一版本。")
        : diag.installed.status === "installed"
          ? `已安装${diag.installed.version ? ` ${diag.installed.version}` : ""}`
          : manifestInstallBlocked && manifestDetail
            ? MANIFEST_BLOCKED_MISSING_STATUS
            : (diag.blockingIssue ?? "尚未安装");

  const shortStatus =
    runtimeInstallRunning
      ? "安装中"
      : diag.installed.status === "installed"
        ? diag.installed.version ?? "已安装"
        : diag.installed.status === "corrupt"
          ? "损坏"
          : manifestInstallBlocked && diag.installed.status === "missing"
            ? "应用内不可用"
            : "未安装";

  const supplementalLines = [
    manifestInstallBlocked && diag.installed.status === "missing" ? MANIFEST_BLOCKED_DEV_HINT : null,
    updateAvailable && diag.availableVersion ? `可升级至 ${diag.availableVersion}` : null,
    diag.requiredDiskBytes
      ? `安装约需 ${formatDiskFree(diag.requiredDiskBytes)}${
          diag.freeDiskBytes != null ? `，可用 ${formatDiskFree(diag.freeDiskBytes)}` : ""
        }`
      : null,
    diag.manifestIssue && diag.manifestSignatureKeyId ? `签名 key：${diag.manifestSignatureKeyId}` : null,
  ].filter((line): line is string => Boolean(line));

  const alertParts = [
    manifestDetail && manifestInstallBlocked && diag.installed.status === "missing"
      ? manifestDetail
      : diag.manifestIssue
        ? diag.installed.status === "installed"
          ? `下载/升级已阻止：${diag.manifestIssue}`
          : diag.manifestIssue
        : null,
    diag.installed.lastVerifyError ? `验证失败：${diag.installed.lastVerifyError}` : null,
    retainedCurrentAfterInstallError && diag.install.error ? `升级未生效：${diag.install.error}` : null,
  ].filter((line): line is string => Boolean(line));

  let alertLine = alertParts.length > 0 ? alertParts.join(" ") : null;
  if (alertLine && alertLine === statusLine) {
    alertLine = null;
  }

  const showDownloadAction = !manifestInstallBlocked || runtimeInstallRunning;

  const needsAttention =
    runtimeInstallRunning ||
    manifestInstallBlocked ||
    diag.installed.status === "missing" ||
    diag.installed.status === "corrupt" ||
    updateAvailable ||
    alertLine != null;

  return {
    shortStatus,
    statusLine,
    supplementalLines,
    alertLine,
    needsAttention,
    manifestInstallBlocked,
    runtimeInstallRunning,
    showDownloadAction,
  };
}

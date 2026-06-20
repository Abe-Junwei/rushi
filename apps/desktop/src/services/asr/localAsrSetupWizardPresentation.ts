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
  /** 侧车下载/安装进行中时展示进度条。 */
  showDownloadProgress: boolean;
  downloadProgressPercent: number;
  downloadProgressLabel: string;
};

export function computeRuntimeDownloadProgress(
  install: LocalRuntimeDiagnose["install"],
): Pick<
  RuntimeInstallPresentation,
  "showDownloadProgress" | "downloadProgressPercent" | "downloadProgressLabel"
> {
  const runtimeInstallRunning = isLocalRuntimeInstallRunning(install.phase);
  if (!runtimeInstallRunning) {
    return {
      showDownloadProgress: false,
      downloadProgressPercent: 0,
      downloadProgressLabel: "",
    };
  }

  const downloaded = install.downloadedBytes ?? null;
  const total = install.totalBytes ?? null;
  const hasByteProgress =
    downloaded != null && total != null && total > 0 && install.phase === "downloading";

  if (hasByteProgress) {
    const percent = Math.min(100, Math.max(0, Math.round((downloaded / total) * 100)));
    return {
      showDownloadProgress: true,
      downloadProgressPercent: percent,
      downloadProgressLabel: `${formatDiskFree(downloaded)} / ${formatDiskFree(total)} · ${percent}%`,
    };
  }

  const phaseLabel =
    install.phase === "downloading"
      ? "下载中…"
      : install.phase === "installing"
        ? "解压安装中…"
        : install.phase === "verifying"
          ? "验证中…"
          : "处理中…";

  return {
    showDownloadProgress: true,
    downloadProgressPercent: install.phase === "downloading" ? 0 : 50,
    downloadProgressLabel: phaseLabel,
  };
}

const MANIFEST_BLOCKED_MISSING_STATUS = "尚未安装 · 应用内下载不可用";

const MANIFEST_BLOCKED_DEV_HINT =
  "开发环境见「环境 → 本机 ASR」诊断，或运行 python -m rushi_asr。";

export function buildDiskMetaLine(report: AsrSetupReport | null): string | null {
  if (!report?.diskFreeBytes) return null;
  return `模型目录可用 ${formatDiskFree(report.diskFreeBytes)}${report.diskLow ? "（偏低）" : ""}`;
}

/** bundled / 8741 已有服务已满足转写时，应用内组件区块仅 informational。 */
export function isExternalSidecarSatisfyingSetup(
  report: AsrSetupReport | null | undefined,
  options?: { selectedModelReady?: boolean },
): boolean {
  if (!report?.health.healthReachable) return false;
  if (report.portStatus === "rushi_asr") return true;
  if (report.bundledAvailable && report.sidecarIntegrity === "ok") return true;
  return options?.selectedModelReady === true;
}

export type RuntimeMaintenanceActions = {
  canRevalidate: boolean;
  canClear: boolean;
  canRestorePrevious: boolean;
  /** 至少有一项组件维护操作可用时为 true。 */
  showComponentMaintenance: boolean;
};

export function buildRuntimeMaintenanceActions(
  diag: LocalRuntimeDiagnose,
  opts: { wizardBusy: boolean; runtimeInstallRunning: boolean },
): RuntimeMaintenanceActions {
  const { wizardBusy, runtimeInstallRunning } = opts;
  const blocked = wizardBusy || runtimeInstallRunning;
  const canRevalidate = !blocked && Boolean(diag.installed.executablePath);
  const canClear = !blocked && diag.installed.status !== "missing";
  const canRestorePrevious = !blocked && Boolean(diag.installed.previousVersion);
  return {
    canRevalidate,
    canClear,
    canRestorePrevious,
    showComponentMaintenance: canRevalidate || canClear || canRestorePrevious,
  };
}

export type RuntimeInstallPresentationOptions = {
  externalSidecarReady?: boolean;
};

export function buildRuntimeInstallPresentation(
  diag: LocalRuntimeDiagnose,
  opts: RuntimeInstallPresentationOptions = {},
): RuntimeInstallPresentation {
  const runtimeInstallRunning = isLocalRuntimeInstallRunning(diag.install.phase);
  const downloadProgress = computeRuntimeDownloadProgress(diag.install);
  const retainedCurrentAfterInstallError =
    diag.install.phase === "error" && diag.installed.status === "installed";
  const manifestInstallBlocked = isLocalRuntimeManifestInstallBlocked(diag);
  const updateAvailable =
    !!diag.availableVersion &&
    !!diag.installed.version &&
    diag.availableVersion !== diag.installed.version;
  const externalSidecarReady = opts.externalSidecarReady === true;

  if (
    externalSidecarReady &&
    diag.installed.status === "missing" &&
    !runtimeInstallRunning
  ) {
    const supplementalLines = [
      !manifestInstallBlocked
        ? "可将侧车安装到应用数据目录，便于 OTA 升级与损坏后自助修复。"
        : "应用内下载源暂不可用；当前转写不依赖应用数据侧车。",
      updateAvailable && diag.availableVersion ? `catalog 可升级至 ${diag.availableVersion}` : null,
    ].filter((line): line is string => Boolean(line));

    return {
      shortStatus: "使用当前侧车",
      statusLine: "转写由安装包内置侧车或本机 8741 服务提供；应用数据组件未安装。",
      supplementalLines,
      alertLine: null,
      needsAttention: false,
      manifestInstallBlocked,
      runtimeInstallRunning,
      showDownloadAction: !manifestInstallBlocked,
      ...downloadProgress,
    };
  }

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
    manifestInstallBlocked && diag.installed.status === "missing" && !externalSidecarReady
      ? MANIFEST_BLOCKED_DEV_HINT
      : null,
    updateAvailable && diag.availableVersion ? `可升级至 ${diag.availableVersion}` : null,
    diag.requiredDiskBytes
      ? `安装约需 ${formatDiskFree(diag.requiredDiskBytes)}${
          diag.freeDiskBytes != null ? `，可用 ${formatDiskFree(diag.freeDiskBytes)}` : ""
        }`
      : null,
    diag.manifestIssue && diag.manifestSignatureKeyId ? `签名 key：${diag.manifestSignatureKeyId}` : null,
  ].filter((line): line is string => Boolean(line));

  const alertParts = [
    manifestDetail && manifestInstallBlocked && diag.installed.status === "missing" && !externalSidecarReady
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
    (!externalSidecarReady && manifestInstallBlocked) ||
    diag.installed.status === "corrupt" ||
    (diag.installed.status === "missing" && !externalSidecarReady) ||
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
    ...downloadProgress,
  };
}

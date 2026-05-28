import { useEffect, useRef } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { formatDiskFree } from "../../services/asr/asrSetupContract";
import {
  isLocalRuntimeInstallRunning,
  isLocalRuntimeManifestInstallBlocked,
} from "../../services/localRuntime/localRuntimeContract";
import type { AsrSetupControllerApi } from "../../pages/useAsrSetupController";
import { isTauriRuntime } from "../../config/env";

type Props = {
  setup: AsrSetupControllerApi;
  busy: boolean;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
};

export function LocalAsrSetupWizard({ setup, busy, openAppDataFolder, exportDiagnosticBundle }: Props) {
  const {
    setupReport,
    localRuntimeDiag,
    setupSteps,
    setupBusy,
    diagnoseBusy,
    setupMessage,
    setupOutcome,
    portConflict,
    refreshSetupDiagnose,
    refreshLocalRuntimeDiagnose,
    downloadLocalRuntime,
    cancelLocalRuntime,
    revalidateLocalRuntime,
    clearLocalRuntime,
    restorePreviousLocalRuntime,
    runOneClickAsrPrepare,
    acceptForeignPortService,
  } = setup;

  const wizardBusy = busy || setupBusy || diagnoseBusy;
  const refreshDisabled = setupBusy || diagnoseBusy || !isTauriRuntime();
  const runtimeInstallRunning = isLocalRuntimeInstallRunning(localRuntimeDiag?.install.phase);
  const retainedCurrentAfterInstallError =
    localRuntimeDiag?.install.phase === "error" && localRuntimeDiag.installed.status === "installed";
  const manifestInstallBlocked = isLocalRuntimeManifestInstallBlocked(localRuntimeDiag);
  const initialDiagnoseTriggeredRef = useRef(false);
  const updateAvailable =
    !!localRuntimeDiag?.availableVersion &&
    !!localRuntimeDiag?.installed.version &&
    localRuntimeDiag.availableVersion !== localRuntimeDiag.installed.version;

  useEffect(() => {
    if (isTauriRuntime() && !initialDiagnoseTriggeredRef.current && !setupReport && !setupBusy && !diagnoseBusy) {
      initialDiagnoseTriggeredRef.current = true;
      void refreshSetupDiagnose({ resetSteps: false, touchUi: false });
    }
  }, [diagnoseBusy, refreshSetupDiagnose, setupBusy, setupReport]);

  return (
    <section className="flex flex-col gap-4">
      <div className="pb-1">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>一键准备本机 ASR</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>
          自动诊断并依次完成：启动内置侧车 → 检测能力 → 下载默认模型（无需终端命令）。
        </p>
      </div>

      {setupReport ? (
        <ul className={`list-none space-y-1.5 p-0 ${PANEL_TYPOGRAPHY.meta}`}>
          {setupReport.summaryLines.map((line) => (
            <li key={line} className="rounded bg-notion-callout-bg px-3 py-1.5 text-notion-text-muted">
              {line}
            </li>
          ))}
          {setupReport.diskFreeBytes != null ? (
            <li className="px-3 text-notion-text-muted">
              模型目录可用空间约 {formatDiskFree(setupReport.diskFreeBytes)}
              {setupReport.diskLow ? "（偏低）" : ""}
            </li>
          ) : null}
          {setupReport.sidecarIntegrity === "corrupt" ? (
            <li className="rounded bg-zen-cinnabar/10 px-3 py-1.5 text-zen-cinnabar">
              内置侧车包完整性异常；一键准备会尝试改用应用数据侧车恢复当前环境。
            </li>
          ) : null}
        </ul>
      ) : (
        <p className={PANEL_TYPOGRAPHY.meta}>尚未诊断。点击下方按钮开始。</p>
      )}

      {localRuntimeDiag ? (
        <div className="rounded bg-notion-callout-bg px-3 py-2 text-[12px] text-notion-text-muted">
          <p className="font-medium text-notion-text">应用内侧车运行时</p>
          <p className="mt-1">
            {runtimeInstallRunning
                ? localRuntimeDiag.install.message
                : retainedCurrentAfterInstallError
                  ? localRuntimeDiag.blockingIssue ??
                    `升级失败，已保留当前版本${localRuntimeDiag.installed.version ? `（${localRuntimeDiag.installed.version}）` : ""}`
                  : localRuntimeDiag.installed.status === "corrupt"
                    ? localRuntimeDiag.installed.detail ?? "已安装组件损坏，请重新下载或恢复上一版本。"
                  : localRuntimeDiag.installed.status === "installed"
                    ? `已安装${localRuntimeDiag.installed.version ? `（${localRuntimeDiag.installed.version}）` : ""}`
                    : localRuntimeDiag.blockingIssue ?? "尚未安装。"}
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
              disabled={
                wizardBusy ||
                runtimeInstallRunning ||
                manifestInstallBlocked
              }
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
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={wizardBusy}
              onClick={() => void openAppDataFolder()}
            >
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
              升级未生效，当前仍使用 {localRuntimeDiag.installed.version ?? "已安装版本"}；
              请使用上方诊断说明、重新验证或导出诊断包继续排查。
            </p>
          ) : null}
        </div>
      ) : null}

      <ol className="flex flex-col gap-2">
        {setupSteps.map((step) => (
          <li
            key={step.id}
            className="flex flex-wrap items-start gap-2 rounded bg-notion-sidebar px-3 py-2"
          >
            <StepDot status={step.status} />
            <div className="min-w-0 flex-1">
              <span className={PANEL_TYPOGRAPHY.fieldLabel}>{step.label}</span>
              {step.detail ? (
                <p className="mt-0.5 text-[11px] text-notion-text-muted">{step.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={CONTROL_BTN_PRIMARY}
          disabled={wizardBusy || !isTauriRuntime()}
          onClick={() => void runOneClickAsrPrepare()}
        >
          {setupBusy ? "准备中…" : "一键准备本机 ASR"}
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={refreshDisabled}
          onClick={() => void refreshSetupDiagnose()}
        >
          {diagnoseBusy ? "诊断中…" : "刷新诊断"}
        </button>
      </div>

      {portConflict ? (
        <div className="rounded border border-notion-divider bg-notion-callout-bg px-3 py-2 text-sm text-notion-text">
          <p className="font-medium text-notion-text">8741 端口冲突</p>
          <p className="mt-1 text-notion-text-muted">
            若该端口已是本机另一实例的 rushi-asr，可尝试使用当前服务；否则请先结束占用进程后再点一键准备。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={wizardBusy}
              onClick={() => void acceptForeignPortService()}
            >
              尝试使用当前服务
            </button>
          </div>
        </div>
      ) : null}

      {setupMessage ? (
        <p
          className={`text-sm ${
            setupOutcome === "ready"
              ? "text-zen-success"
              : setupOutcome === "error" || setupOutcome === "blocked"
                ? "text-zen-cinnabar"
                : "text-notion-text-muted"
          }`}
          role="status"
        >
          {setupMessage}
        </p>
      ) : null}
    </section>
  );
}

function StepDot({ status }: { status: string }) {
  const cls =
    status === "ok"
      ? "bg-zen-success"
      : status === "running"
        ? "bg-zen-saffron"
        : status === "error"
          ? "bg-zen-cinnabar"
          : status === "skipped"
            ? "bg-notion-text-light"
            : "bg-notion-divider";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

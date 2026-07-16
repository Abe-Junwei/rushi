import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { AsrCudaSidecarStatus } from "../../tauri/asrCudaApi";
import { isAsrCudaInstallRunning } from "../../tauri/asrCudaApi";

type Props = {
  status: AsrCudaSidecarStatus | null;
  busy: boolean;
  message: string;
  onDownload: () => void;
  onCancel: () => void;
  onRestartSidecar: () => Promise<void>;
};

function formatProgress(status: AsrCudaSidecarStatus): string | null {
  const { downloadedBytes, totalBytes } = status.install;
  if (downloadedBytes == null || totalBytes == null || totalBytes <= 0) {
    return null;
  }
  const pct = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
  return `${pct}%`;
}

export function EnvAsrCudaRecommendBanner({
  status,
  busy,
  message,
  onDownload,
  onCancel,
  onRestartSidecar,
}: Props) {
  if (!status?.platformSupported) {
    return null;
  }

  const running = isAsrCudaInstallRunning(status.install.phase) || busy;
  const showRecommend = status.recommendDownload || running || Boolean(message);
  const showInstalledHint =
    status.cudaInstalled && status.nvidiaDetected && status.install.phase === "installed";

  if (!showRecommend && !showInstalledHint) {
    return null;
  }

  const progressLabel = formatProgress(status);

  return (
    <section
      className="rounded-sm bg-notion-sidebar px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <p className={PANEL_TYPOGRAPHY.envSectionTitle}>GPU 加速（可选）</p>
      {status.recommendDownload || running ? (
        <p className={`${PANEL_TYPOGRAPHY.meta} mt-1`}>
          检测到 NVIDIA 显卡，可下载 GPU 加速组件以加快本机转写。下载失败或取消时仍使用 CPU，不影响转写。
        </p>
      ) : null}
      {showInstalledHint ? (
        <p className={`${PANEL_TYPOGRAPHY.meta} mt-1`}>
          GPU 加速组件已就绪。若当前仍在使用 CPU，请重启侧车。
        </p>
      ) : null}
      {status.install.message ? (
        <p className={`${PANEL_TYPOGRAPHY.meta} mt-1`}>{status.install.message}</p>
      ) : null}
      {message ? <p className={`${PANEL_TYPOGRAPHY.meta} mt-1`}>{message}</p> : null}
      {progressLabel ? (
        <p className={`${PANEL_TYPOGRAPHY.meta} mt-1`}>下载进度 {progressLabel}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {status.recommendDownload || running ? (
          <button
            type="button"
            className={CONTROL_BTN_PRIMARY}
            disabled={running && status.install.phase !== "error"}
            onClick={() => onDownload()}
          >
            {running ? "下载中…" : "下载 GPU 加速组件"}
          </button>
        ) : null}
        {running ? (
          <button type="button" className={CONTROL_BTN_SECONDARY} onClick={() => onCancel()}>
            取消下载
          </button>
        ) : null}
        {status.cudaInstalled || status.install.phase === "installed" ? (
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            onClick={() => void onRestartSidecar()}
          >
            重启侧车
          </button>
        ) : null}
      </div>
    </section>
  );
}

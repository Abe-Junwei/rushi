import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { AsrModelCacheInfo } from "../../tauri/projectApi";

type Props = {
  asrModelCacheInfo: AsrModelCacheInfo | null;
  asrModelCacheBusy: boolean;
  busy: boolean;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
};

export function LocalAsrCacheSection({
  asrModelCacheInfo,
  asrModelCacheBusy,
  busy,
  refreshAsrModelCacheInfo,
  clearAsrModelCache,
  openAppDataFolder,
}: Props) {
  const manifestStatus =
    asrModelCacheInfo == null
      ? "未读取"
      : asrModelCacheInfo.manifest_path
        ? asrModelCacheInfo.manifest_exists
          ? "已配置，文件存在"
          : "已配置，但文件不存在"
        : "未配置";
  const clearDisabled = busy || asrModelCacheBusy || (asrModelCacheInfo?.total_bytes ?? 0) <= 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="pb-1">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>缓存与校验</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>查看模型缓存目录、占用大小与 manifest 校验配置。</p>
      </div>
      <div className="flex flex-col gap-2 rounded bg-notion-callout-bg px-3 py-3">
        <InfoRow label="缓存目录" value={asrModelCacheInfo?.models_root ?? "未读取"} mono />
        <InfoRow label="当前占用" value={formatBytes(asrModelCacheInfo?.total_bytes ?? 0)} />
        <InfoRow label="ModelScope" value={asrModelCacheInfo?.modelscope_cache ?? "未读取"} mono />
        <InfoRow label="HuggingFace" value={asrModelCacheInfo?.huggingface_cache ?? "未读取"} mono />
        <InfoRow label="manifest 校验" value={manifestStatus} />
        {asrModelCacheInfo?.manifest_path ? (
          <p className="text-[11px] text-notion-text-muted">
            manifest 路径：<code className="font-mono text-zen-indigo">{asrModelCacheInfo.manifest_path}</code>
          </p>
        ) : null}
        <p className="text-[11px] text-notion-text-muted">
          manifest 展示基于桌面壳当前环境变量；若 ASR 是在外部终端单独启动，实际运行配置可能与此不同。
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionButton disabled={busy || asrModelCacheBusy} onClick={() => void refreshAsrModelCacheInfo()}>
          {asrModelCacheBusy ? "处理中…" : "刷新缓存信息"}
        </ActionButton>
        <ActionButton
          disabled={clearDisabled}
          onClick={() => {
            if (!window.confirm("确认清除已下载的模型缓存吗？此操作不会删除数据库或项目文件。")) return;
            void clearAsrModelCache();
          }}
        >
          {asrModelCacheBusy ? "清理中…" : "清除模型缓存"}
        </ActionButton>
        <ActionButton disabled={busy} onClick={() => void openAppDataFolder()}>
          打开应用数据目录
        </ActionButton>
      </div>
    </section>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <span className={PANEL_TYPOGRAPHY.fieldLabel}>{label}</span>
      <span className={`${PANEL_TYPOGRAPHY.meta} ${mono ? "font-mono text-[11px] text-zen-indigo" : ""}`}>{value}</span>
    </div>
  );
}

function ActionButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 rounded border border-notion-divider bg-notion-bg px-2.5 py-1 ${PANEL_TYPOGRAPHY.button} text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:opacity-40`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const digits = idx === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[idx]}`;
}

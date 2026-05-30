import { useState } from "react";
import { ClearAsrCacheConfirmDialog } from "../ClearAsrCacheConfirmDialog";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { AsrModelCacheInfo, WaveformPeaksCacheInfo } from "../../tauri/projectApi";

type Props = {
  asrModelCacheInfo: AsrModelCacheInfo | null;
  waveformPeaksCacheInfo: WaveformPeaksCacheInfo | null;
  asrModelCacheBusy: boolean;
  asrCacheMessage: string;
  busy: boolean;
  prepareModelBusy?: boolean;
  tauriRuntime: boolean;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  clearOrphanWaveformPeaksCache: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
};

export function LocalAsrCacheSection({
  asrModelCacheInfo,
  waveformPeaksCacheInfo,
  asrModelCacheBusy,
  asrCacheMessage,
  busy,
  prepareModelBusy = false,
  tauriRuntime,
  refreshAsrModelCacheInfo,
  clearAsrModelCache,
  clearOrphanWaveformPeaksCache,
  openAppDataFolder,
}: Props) {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const manifestStatus =
    asrModelCacheInfo == null
      ? "未读取"
      : asrModelCacheInfo.manifest_path
        ? asrModelCacheInfo.manifest_exists
          ? "已配置，文件存在"
          : "已配置，但文件不存在"
        : "未配置";
  const clearDisabled = !tauriRuntime || busy || asrModelCacheBusy || prepareModelBusy;
  const clearDisabledReason = !tauriRuntime ? "需在桌面应用中运行（npm run desktop:dev 或安装包）" : null;

  const onConfirmClear = () => {
    void clearAsrModelCache().finally(() => setConfirmClearOpen(false));
  };

  return (
    <section className="flex flex-col gap-4">
      <ClearAsrCacheConfirmDialog
        open={confirmClearOpen}
        busy={asrModelCacheBusy}
        totalBytes={asrModelCacheInfo?.total_bytes ?? null}
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={onConfirmClear}
      />
      <div className="pb-1">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>缓存与校验</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>
          查看模型缓存与项目音频/波形缓存占用；删除项目或文件后会自动清理对应副本。
        </p>
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
        {asrModelCacheInfo?.manifest_path && !asrModelCacheInfo.manifest_exists ? (
          <p className="text-[11px] leading-relaxed text-zen-cinnabar">
            环境变量已设置，但该路径下尚无文件。请把 JSON（内容可为 <code className="font-mono">[]</code>）建在上方「manifest
            路径」所指位置（不要只用单层 Application Support 目录），保存后点「刷新缓存信息」。
          </p>
        ) : null}
        <p className="text-[11px] text-notion-text-muted">
          占用仅统计应用数据目录下的 <code className="font-mono text-zen-indigo">models/</code>；若 ASR 在终端单独启动且未设置
          RUSHI_MODELS_ROOT，权重可能在其他路径，此处清理不会生效。
        </p>
        <p className="text-[11px] text-notion-text-muted">
          manifest 状态读取自<strong className="font-medium text-notion-text">桌面应用进程</strong>的{" "}
          <code className="font-mono text-zen-indigo">RUSHI_MODEL_VERIFY_MANIFEST</code>（相对路径相对上方「缓存目录」解析）。
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded bg-notion-callout-bg px-3 py-3">
        <InfoRow
          label="项目缓存目录"
          value={waveformPeaksCacheInfo?.projects_root ?? "未读取"}
          mono
        />
        <InfoRow label="项目缓存总占用" value={formatBytes(waveformPeaksCacheInfo?.total_bytes ?? 0)} />
        <InfoRow
          label="可清理旧缓存"
          value={
            waveformPeaksCacheInfo == null
              ? "未读取"
              : `${formatBytes(waveformPeaksCacheInfo.orphan_bytes)} · ${waveformPeaksCacheInfo.orphan_file_sets} 组波形 · ${waveformPeaksCacheInfo.orphan_project_dirs} 个孤立项目`
          }
        />
        <p className="text-[11px] text-notion-text-muted">
          包含项目内复制的音频与预计算波形（<code className="font-mono text-zen-indigo">projects/*/peaks</code>
          ）。删除项目/文件时会自动清理；此处仅补清数据库已不存在但仍留在磁盘上的副本。
        </p>
      </div>
      {asrCacheMessage ? (
        <p className="rounded bg-notion-callout-bg px-3 py-2 text-[12px] text-notion-text">{asrCacheMessage}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <ActionButton disabled={busy || asrModelCacheBusy} onClick={() => void refreshAsrModelCacheInfo()}>
          {asrModelCacheBusy ? "处理中…" : "刷新缓存信息"}
        </ActionButton>
        <ActionButton
          disabled={clearDisabled}
          title={clearDisabledReason ?? undefined}
          onClick={() => void clearOrphanWaveformPeaksCache()}
        >
          {asrModelCacheBusy ? "清理中…" : "清除项目旧缓存"}
        </ActionButton>
        <ActionButton
          disabled={clearDisabled}
          title={clearDisabledReason ?? undefined}
          onClick={() => setConfirmClearOpen(true)}
        >
          {asrModelCacheBusy ? "清理中…" : "清除模型缓存"}
        </ActionButton>
        <ActionButton disabled={busy} onClick={() => void openAppDataFolder()}>
          打开应用数据目录
        </ActionButton>
      </div>
      {clearDisabledReason ? (
        <p className="text-[11px] text-notion-text-muted">{clearDisabledReason}</p>
      ) : null}
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

function ActionButton({
  children,
  disabled,
  title,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 rounded border border-notion-divider bg-notion-bg px-2.5 py-1 ${PANEL_TYPOGRAPHY.button} text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:opacity-40`}
      disabled={disabled}
      title={title}
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

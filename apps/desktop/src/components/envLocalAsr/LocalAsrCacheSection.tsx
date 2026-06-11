import { useState } from "react";
import { ClearAsrCacheConfirmDialog } from "../ClearAsrCacheConfirmDialog";
import { ENV_COMPACT_BTN } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { AsrModelCacheInfo, WaveformPeaksCacheInfo } from "../../tauri/projectApi";
import {
  EnvUtilitiesActionRow,
  EnvUtilitiesMetaGroup,
  EnvUtilitiesSubsection,
} from "./envLocalAsrPanelUi";

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
  embedded?: boolean;
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
  embedded = false,
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
    <section className="flex flex-col gap-3">
      <ClearAsrCacheConfirmDialog
        open={confirmClearOpen}
        busy={asrModelCacheBusy}
        totalBytes={asrModelCacheInfo?.total_bytes ?? null}
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={onConfirmClear}
      />
      {!embedded ? (
        <div>
          <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>缓存与校验</h3>
          <p className={PANEL_TYPOGRAPHY.sectionDescription}>
            查看模型缓存与项目音频/波形缓存占用；删除项目或文件后会自动清理对应副本。
          </p>
        </div>
      ) : (
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          查看模型缓存与项目音频/波形缓存占用；删除项目或文件后会自动清理对应副本。
        </p>
      )}

      <EnvUtilitiesSubsection title="模型缓存">
        <div className="flex flex-col gap-2">
          <InfoRow label="缓存目录" value={asrModelCacheInfo?.models_root ?? "未读取"} mono />
          <InfoRow label="当前占用" value={formatBytes(asrModelCacheInfo?.total_bytes ?? 0)} />
          <InfoRow label="ModelScope" value={asrModelCacheInfo?.modelscope_cache ?? "未读取"} mono />
          <InfoRow label="HuggingFace" value={asrModelCacheInfo?.huggingface_cache ?? "未读取"} mono />
          <InfoRow label="manifest 校验" value={manifestStatus} />
        </div>
        <EnvUtilitiesMetaGroup>
          {asrModelCacheInfo?.manifest_path ? (
            <p className="m-0">
              manifest 路径：<code className="font-mono text-zen-indigo">{asrModelCacheInfo.manifest_path}</code>
            </p>
          ) : null}
          {asrModelCacheInfo?.manifest_path && !asrModelCacheInfo.manifest_exists ? (
            <p className="m-0 text-zen-cinnabar">
              环境变量已设置，但该路径下尚无文件。请把 JSON（内容可为 <code className="font-mono">[]</code>
              ）建在上方「manifest 路径」所指位置（不要只用单层 Application Support 目录），保存后点「刷新缓存信息」。
            </p>
          ) : null}
          <p className="m-0">
            占用仅统计应用数据目录下的 <code className="font-mono text-zen-indigo">models/</code>；若 ASR
            在终端单独启动且未设置 RUSHI_MODELS_ROOT，权重可能在其他路径，此处清理不会生效。
          </p>
          <p className="m-0">
            manifest 状态读取自<strong className="font-medium text-notion-text">桌面应用进程</strong>的{" "}
            <code className="font-mono text-zen-indigo">RUSHI_MODEL_VERIFY_MANIFEST</code>
            （相对路径相对上方「缓存目录」解析）。
          </p>
        </EnvUtilitiesMetaGroup>
      </EnvUtilitiesSubsection>

      <EnvUtilitiesSubsection title="项目缓存">
        <div className="flex flex-col gap-2">
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
        </div>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          包含项目内复制的音频与预计算波形（
          <code className="font-mono text-zen-indigo">projects/*/peaks</code>
          ）。删除项目/文件时会自动清理；此处仅补清数据库已不存在但仍留在磁盘上的副本。
        </p>
      </EnvUtilitiesSubsection>

      {asrCacheMessage ? (
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`} role="status">
          {asrCacheMessage}
        </p>
      ) : null}

      <EnvUtilitiesActionRow>
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
          打开数据目录
        </ActionButton>
      </EnvUtilitiesActionRow>

      {clearDisabledReason ? <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{clearDisabledReason}</p> : null}
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
      className={ENV_COMPACT_BTN}
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

import { useCallback, useState } from "react";
import type { AsrModelCacheInfo, WaveformPeaksCacheInfo } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";

type Params = {
  tauriRuntime: boolean;
  onAfterCacheMutation: () => Promise<void>;
};

export function useAsrModelCacheController({ tauriRuntime, onAfterCacheMutation }: Params) {
  const [asrModelCacheInfo, setAsrModelCacheInfo] = useState<AsrModelCacheInfo | null>(null);
  const [waveformPeaksCacheInfo, setWaveformPeaksCacheInfo] = useState<WaveformPeaksCacheInfo | null>(null);
  const [asrModelCacheBusy, setAsrModelCacheBusy] = useState(false);
  const [asrCacheMessage, setAsrCacheMessage] = useState("");

  const refreshAsrModelCacheInfo = useCallback(async () => {
    if (!tauriRuntime) {
      setAsrModelCacheInfo(null);
      setWaveformPeaksCacheInfo(null);
      setAsrCacheMessage("浏览器预览无法读取模型缓存，请在桌面应用中操作。");
      return;
    }
    try {
      const [info, peaksInfo] = await Promise.all([
        p1.asrModelCacheInfo(),
        p1.waveformPeaksCacheInfo(),
      ]);
      setAsrModelCacheInfo(info);
      setWaveformPeaksCacheInfo(peaksInfo);
      setAsrCacheMessage("");
    } catch (e) {
      setAsrModelCacheInfo(null);
      setWaveformPeaksCacheInfo(null);
      setAsrCacheMessage(
        `读取缓存信息失败：${e instanceof Error ? e.message : String(e)}。请确认在 Tauri 桌面壳中运行。`,
      );
    }
  }, [tauriRuntime]);

  const clearAsrModelCache = useCallback(async () => {
    if (!tauriRuntime) {
      setAsrCacheMessage("清除模型缓存需要在桌面应用中运行（npm run desktop:dev 或安装包），浏览器预览不支持。");
      return;
    }
    setAsrModelCacheBusy(true);
    setAsrCacheMessage("");
    try {
      const info = await p1.clearAsrModelCache();
      setAsrModelCacheInfo(info);
      const mb = info.total_bytes / (1024 * 1024);
      const sizeLabel =
        info.total_bytes <= 0 ? "0 B" : mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${(info.total_bytes / 1024).toFixed(0)} KB`;
      setAsrCacheMessage(`已清除模型缓存。当前占用约 ${sizeLabel}。可重新下载当前所选模型权重。`);
    } catch (e) {
      setAsrCacheMessage(`清除模型缓存失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAsrModelCacheBusy(false);
      await onAfterCacheMutation();
    }
  }, [onAfterCacheMutation, tauriRuntime]);

  const clearOrphanWaveformPeaksCache = useCallback(async () => {
    if (!tauriRuntime) {
      setAsrCacheMessage("清除波形缓存需要在桌面应用中运行（npm run desktop:dev 或安装包），浏览器预览不支持。");
      return;
    }
    setAsrModelCacheBusy(true);
    setAsrCacheMessage("");
    try {
      const result = await p1.clearOrphanWaveformPeaksCache();
      setWaveformPeaksCacheInfo(result.cache);
      if (result.gc.removed_file_sets === 0 && result.gc.removed_project_dirs === 0) {
        setAsrCacheMessage("未发现可清理的项目音频/波形缓存。");
      } else {
        const mb = result.gc.freed_bytes / (1024 * 1024);
        const sizeLabel =
          result.gc.freed_bytes <= 0
            ? "0 B"
            : mb >= 0.1
              ? `${mb.toFixed(1)} MB`
              : `${(result.gc.freed_bytes / 1024).toFixed(0)} KB`;
        const parts = [
          result.gc.removed_file_sets > 0 ? `${result.gc.removed_file_sets} 组旧波形` : null,
          result.gc.removed_project_dirs > 0 ? `${result.gc.removed_project_dirs} 个孤立项目目录` : null,
        ].filter(Boolean);
        setAsrCacheMessage(
          `已清除 ${parts.join("、")}，释放约 ${sizeLabel}。当前项目中的音频文件不受影响。`,
        );
      }
    } catch (e) {
      setAsrCacheMessage(`清除旧波形缓存失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAsrModelCacheBusy(false);
    }
  }, [tauriRuntime]);

  return {
    asrModelCacheInfo,
    waveformPeaksCacheInfo,
    asrModelCacheBusy,
    asrCacheMessage,
    refreshAsrModelCacheInfo,
    clearAsrModelCache,
    clearOrphanWaveformPeaksCache,
  };
}

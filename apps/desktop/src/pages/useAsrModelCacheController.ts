import { useCallback, useState } from "react";
import type { AsrModelCacheInfo } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";

type Params = {
  tauriRuntime: boolean;
  onAfterCacheMutation: () => Promise<void>;
};

export function useAsrModelCacheController({ tauriRuntime, onAfterCacheMutation }: Params) {
  const [asrModelCacheInfo, setAsrModelCacheInfo] = useState<AsrModelCacheInfo | null>(null);
  const [asrModelCacheBusy, setAsrModelCacheBusy] = useState(false);
  const [asrCacheMessage, setAsrCacheMessage] = useState("");

  const refreshAsrModelCacheInfo = useCallback(async () => {
    if (!tauriRuntime) {
      setAsrModelCacheInfo(null);
      setAsrCacheMessage("浏览器预览无法读取模型缓存，请在桌面应用中操作。");
      return;
    }
    try {
      const info = await p1.asrModelCacheInfo();
      setAsrModelCacheInfo(info);
      setAsrCacheMessage("");
    } catch (e) {
      setAsrModelCacheInfo(null);
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

  return {
    asrModelCacheInfo,
    asrModelCacheBusy,
    asrCacheMessage,
    refreshAsrModelCacheInfo,
    clearAsrModelCache,
  };
}

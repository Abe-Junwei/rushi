import { useCallback, useEffect, useState } from "react";
import { CONTROL_BTN_SECONDARY, CONTROL_BTN_TOOLBAR_GHOST } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  getMediaBaseDirInfo,
  openAppDataFolder,
  pickMediaBaseDir,
  setMediaBaseDirPref,
  type MediaBaseDirInfo,
} from "../tauri/projectApi";
import { ENV_PANEL_FORM_FIELD_CLASS, ENV_PANEL_FORM_FIELDS_CLASS } from "../utils/environmentPanelNav";
import { EnvPrefGroupShell } from "./EnvPrefGroupShell";

/**
 * L1 媒体基准 / L2 本地库根 / L3 网盘纪律 — 见
 * `docs/execution/specs/user-library-location-intent.md` 能力—UI 矩阵。
 */
export function EnvLibraryLocationSection() {
  const [info, setInfo] = useState<MediaBaseDirInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await getMediaBaseDirInfo();
      setInfo(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPick = useCallback(async () => {
    setBusy(true);
    try {
      const next = await pickMediaBaseDir();
      if (next) setInfo(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const onReset = useCallback(async () => {
    setBusy(true);
    try {
      const next = await setMediaBaseDirPref(null);
      setInfo(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <EnvPrefGroupShell
      title="内容库位置"
      description="媒体可放到自选目录（含网盘「始终保留在此设备」）；数据库与模型始终留在本机。"
    >
      <div className={ENV_PANEL_FORM_FIELDS_CLASS}>
        <div className={ENV_PANEL_FORM_FIELD_CLASS}>
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>媒体基准目录</span>
          <p className={`m-0 break-all font-mono text-label text-notion-text ${PANEL_TYPOGRAPHY.meta}`}>
            {info?.mediaBaseDir ?? "加载中…"}
            {info?.isCustom ? (
              <span className="ml-2 text-notion-text-muted">（自定义）</span>
            ) : (
              <span className="ml-2 text-notion-text-muted">（默认：与应用数据同根）</span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={busy}
              onClick={() => void onPick()}
            >
              选择文件夹…
            </button>
            <button
              type="button"
              className={CONTROL_BTN_TOOLBAR_GHOST}
              disabled={busy || !info?.isCustom}
              onClick={() => void onReset()}
            >
              恢复默认
            </button>
          </div>
          <span className={PANEL_TYPOGRAPHY.meta}>
            新导入的音频会复制到该目录下的 projects/；语段与项目元数据仍在本机数据库。
          </span>
        </div>

        <div className={ENV_PANEL_FORM_FIELD_CLASS}>
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>数据库与模型（本机）</span>
          <p className={`m-0 break-all font-mono text-label text-notion-text ${PANEL_TYPOGRAPHY.meta}`}>
            {info?.appDataRoot ?? "加载中…"}
          </p>
          <div className="mt-2">
            <button
              type="button"
              className={CONTROL_BTN_TOOLBAR_GHOST}
              onClick={() => void openAppDataFolder()}
            >
              在文件管理器中打开
            </button>
          </div>
          <span className={PANEL_TYPOGRAPHY.meta}>
            含 rushi.sqlite3、模型缓存与密钥。请勿将此目录放进 OneDrive / iCloud / 坚果云等同步盘，以免数据库损坏。
          </span>
        </div>

        <p
          className={`m-0 rounded-sm bg-notion-sidebar px-3 py-2 text-body text-notion-text-muted ${PANEL_TYPOGRAPHY.meta}`}
          role="note"
        >
          跨设备：媒体可用网盘同步；项目数据请用「项目包」导出/导入，或等待联机协作。不要指望把整个应用数据目录放进网盘实现同步。
        </p>

        {error ? (
          <p className="m-0 text-body text-zen-cinnabar" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </EnvPrefGroupShell>
  );
}

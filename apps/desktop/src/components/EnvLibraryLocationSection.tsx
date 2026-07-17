import { useCallback, useEffect, useState } from "react";
import { CONTROL_BTN_SECONDARY, CONTROL_BTN_TOOLBAR_GHOST } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  getMediaBaseDirInfo,
  pickMediaBaseDir,
  setMediaBaseDirPref,
  type MediaBaseDirInfo,
} from "../tauri/projectApi";
import { ENV_PANEL_FORM_FIELD_CLASS, ENV_PANEL_FORM_FIELDS_CLASS } from "../utils/environmentPanelNav";
import { EnvPrefGroupShell } from "./EnvPrefGroupShell";

/**
 * 媒体存放目录（Zotero 式：prefs 只露路径与操作；纪律说明见 research/intent）。
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
    <EnvPrefGroupShell title="内容库位置" description="新导入音频的存放目录。">
      <div className={ENV_PANEL_FORM_FIELDS_CLASS}>
        <div className={ENV_PANEL_FORM_FIELD_CLASS}>
          <p className={`m-0 break-all font-mono text-label text-notion-text ${PANEL_TYPOGRAPHY.meta}`}>
            {info?.mediaBaseDir ?? "加载中…"}
            {info && !info.isCustom ? (
              <span className="ml-2 text-notion-text-muted">默认</span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={busy}
              onClick={() => void onPick()}
            >
              选择…
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
        </div>

        {error ? (
          <p className="m-0 text-body text-zen-cinnabar" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </EnvPrefGroupShell>
  );
}

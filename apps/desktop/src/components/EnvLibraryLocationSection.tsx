import { useCallback, useEffect, useState } from "react";
import { CONTROL_BTN_SECONDARY, CONTROL_BTN_TOOLBAR_GHOST } from "../config/controlStyles";
import { OVERLAY_SCRIM_LAYER } from "../config/overlayStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  commitMediaBaseDirChange,
  getMediaBaseDirInfo,
  getMediaBaseManagedSummary,
  pickMediaBaseDirPreview,
  type MediaBaseDirInfo,
  type MediaBaseManagedSummary,
} from "../tauri/projectApi";
import { tauriCommandErrorMessage } from "../tauri/commandError";
import { ENV_PANEL_FORM_FIELD_CLASS, ENV_PANEL_FORM_FIELDS_CLASS } from "../utils/environmentPanelNav";
import { CompactConfirmDialog } from "./CompactConfirmDialog";
import { EnvPrefGroupShell } from "./EnvPrefGroupShell";

type PendingChange = {
  path: string | null;
  summary: MediaBaseManagedSummary;
};

/** Must stay above environment panel (z-110) and its scrim (z-100). */
const SETTINGS_CHILD_DIALOG_Z = 120;
const SETTINGS_CHILD_OVERLAY_CLASS = `${OVERLAY_SCRIM_LAYER} z-[115]`;

/**
 * 媒体存放目录；有受管媒体时仅「搬迁 / 取消」（见薄片 2 intent）。
 */
export function EnvLibraryLocationSection() {
  const [info, setInfo] = useState<MediaBaseDirInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingChange | null>(null);

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

  const runCommit = useCallback(async (path: string | null, relocate: boolean) => {
    setBusy(true);
    setError(null);
    // Let React paint 「正在搬迁…」before IPC work (esp. Windows WebView2).
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    try {
      const next = await commitMediaBaseDirChange(path, relocate);
      setInfo(next);
      setPending(null);
      setError(null);
    } catch (e) {
      // Keep dialog open; error is shown inside the confirm body (settings panel text is covered).
      setError(tauriCommandErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const onPick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const preview = await pickMediaBaseDirPreview();
      if (!preview) return;
      if (!preview.summary.needsRelocate) {
        // Keep busy through commit; runCommit owns the flag from here.
        setBusy(false);
        await runCommit(preview.path, false);
        return;
      }
      setPending({ path: preview.path, summary: preview.summary });
    } catch (e) {
      setError(tauriCommandErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [busy, runCommit]);

  const onReset = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const summary = await getMediaBaseManagedSummary();
      if (!summary.needsRelocate) {
        setBusy(false);
        await runCommit(null, false);
        return;
      }
      setPending({ path: null, summary });
    } catch (e) {
      setError(tauriCommandErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [busy, runCommit]);

  const pendingLabel =
    pending?.path == null ? "应用数据目录（默认）" : pending.path;

  return (
    <>
      <EnvPrefGroupShell title="内容库位置" description="新导入音频的存放目录。">
        <div className={ENV_PANEL_FORM_FIELDS_CLASS}>
          <div className={ENV_PANEL_FORM_FIELD_CLASS}>
            <p className={`m-0 break-all font-mono text-label text-notion-text ${PANEL_TYPOGRAPHY.meta}`}>
              {info?.mediaBaseDir ?? "加载中…"}
              {info && !info.isCustom ? (
                <span className="ml-2 text-notion-text-muted">默认</span>
              ) : null}
            </p>
            {info?.unavailable ? (
              <p className="m-0 text-body text-zen-cinnabar" role="alert">
                目录不可达（可能已被删除、移动或所在磁盘未挂载）。可点击「恢复默认」或「选择…」重新连接。
              </p>
            ) : null}
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

          {error && pending == null ? (
            <p className="m-0 text-body text-zen-cinnabar" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </EnvPrefGroupShell>

      <CompactConfirmDialog
        id="media-base-relocate"
        title={info?.unavailable ? "重新连接媒体库" : "搬迁媒体库"}
        open={pending != null}
        busy={busy}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
        onConfirm={() => {
          if (!pending || busy) return;
          void runCommit(pending.path, true);
        }}
        confirmLabel={info?.unavailable ? "重新连接" : "搬迁"}
        busyConfirmLabel={info?.unavailable ? "正在连接…" : "正在搬迁…"}
        cancelLabel="取消"
        fallbackHeight={220}
        defaultWidth={420}
        panelZIndex={SETTINGS_CHILD_DIALOG_Z}
        overlayClassName={SETTINGS_CHILD_OVERLAY_CLASS}
      >
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          {info?.unavailable
            ? `旧目录不可达，无法搬迁 ${pending?.summary.fileCount ?? 0} 个音频文件。将尝试在新位置按原有结构重新连接已存在的文件：`
            : `将把 ${pending?.summary.fileCount ?? 0} 个音频文件（及波形缓存）搬到：`}
        </p>
        <p className={`m-0 mt-2 break-all font-mono text-label ${PANEL_TYPOGRAPHY.meta}`}>
          {pendingLabel}
        </p>
        <p className={`m-0 mt-3 ${PANEL_TYPOGRAPHY.meta}`}>
          {info?.unavailable
            ? "未在新位置找到的文件仍会显示为缺失，可稍后手动补齐或重新导入。项目与数据库仍在本机。"
            : "搬迁时会停止当前音频播放。若目标在网盘，请设为「始终保留在此设备」。目录将含波形缓存。项目与数据库仍在本机。"}
        </p>
        {error ? (
          <p className="m-0 mt-3 text-body text-zen-cinnabar" role="alert">
            {error}
          </p>
        ) : null}
      </CompactConfirmDialog>
    </>
  );
}

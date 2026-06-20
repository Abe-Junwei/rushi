import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import type { Update } from "@tauri-apps/plugin-updater";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { ENV_PANEL_PAGE_CLASS, ENV_PANEL_SECTION_CLASS } from "../utils/environmentPanelNav";
import { CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { isTauriRuntime } from "../config/env";
import { toast } from "../services/ui/toast";
import {
  appUpdateUnsupportedMessage,
  checkForAppUpdate,
  downloadAndInstallAppUpdate,
  isAppUpdateSupportedForVersion,
  mapAppUpdateError,
} from "../services/appUpdate";
import {
  fetchAppBuildInfo,
  openBundledUserGuide,
  readThirdPartyLicenses,
  type AppBuildInfo,
  type ThirdPartyLicenses,
} from "../tauri/appInfoApi";
import {
  formatAppBuildInfoForClipboard,
  formatPlatformLabel,
} from "../utils/appBuildInfoCopy";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { BrandLockup } from "./BrandLockup";
import { AppUpdateConfirmDialog } from "./AppUpdateConfirmDialog";

const APP_COPYRIGHT = "版权所有 © 沂南灵创技术服务中心";

type LoadState = "loading" | "ready" | "error";

type UpdateUiState = "idle" | "checking" | "installing";

const LICENSE_PROSE_CLASS = `max-h-[min(420px,45vh)] overflow-y-auto whitespace-pre-wrap rounded-md bg-notion-sidebar px-4 py-3 ${PANEL_TYPOGRAPHY.body} text-notion-text`;

function LicenseProseBlock({
  state,
  error,
  text,
}: {
  state: LoadState;
  error: string | null;
  text: string | null;
}) {
  if (state === "error") {
    return <p className={`m-0 ${PANEL_TYPOGRAPHY.body} text-notion-text-muted`}>{error}</p>;
  }
  if (state === "ready" && text) {
    return <div className={LICENSE_PROSE_CLASS}>{text}</div>;
  }
  return <p className={`m-0 ${PANEL_TYPOGRAPHY.body} text-notion-text-muted`}>加载中…</p>;
}

export function EnvAboutPanel() {
  const [buildInfo, setBuildInfo] = useState<AppBuildInfo | null>(null);
  const [buildInfoState, setBuildInfoState] = useState<LoadState>("loading");
  const [buildInfoError, setBuildInfoError] = useState<string | null>(null);
  const [licenses, setLicenses] = useState<ThirdPartyLicenses | null>(null);
  const [licensesState, setLicensesState] = useState<LoadState>("loading");
  const [licensesError, setLicensesError] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [guideBusy, setGuideBusy] = useState(false);
  const [updateUiState, setUpdateUiState] = useState<UpdateUiState>("idle");
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateDialogVersion, setUpdateDialogVersion] = useState("");
  const [updateDialogNotes, setUpdateDialogNotes] = useState<string | undefined>();
  const pendingUpdateRef = useRef<Update | null>(null);

  const updateSupported =
    isTauriRuntime() && buildInfo != null && isAppUpdateSupportedForVersion(buildInfo.version);
  const updateBusy = updateUiState !== "idle";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const info = await fetchAppBuildInfo();
        if (cancelled) return;
        setBuildInfo(info);
        setBuildInfoState("ready");
        setBuildInfoError(null);
      } catch (e) {
        if (cancelled) return;
        setBuildInfoState("error");
        setBuildInfoError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await readThirdPartyLicenses();
        if (cancelled) return;
        setLicenses(payload);
        setLicensesState("ready");
        setLicensesError(null);
      } catch (e) {
        if (cancelled) return;
        setLicensesState("error");
        setLicensesError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyBuildInfo = useCallback(async () => {
    if (!buildInfo) return;
    setCopyBusy(true);
    try {
      await navigator.clipboard.writeText(formatAppBuildInfoForClipboard(buildInfo));
      toast.success("已复制版本信息");
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setCopyBusy(false);
    }
  }, [buildInfo]);

  const openUserGuide = useCallback(async () => {
    setGuideBusy(true);
    try {
      await openBundledUserGuide();
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setGuideBusy(false);
    }
  }, []);

  const checkUpdates = useCallback(async () => {
    if (!buildInfo || updateBusy) return;
    if (!isAppUpdateSupportedForVersion(buildInfo.version)) {
      toast.info(appUpdateUnsupportedMessage());
      return;
    }
    setUpdateUiState("checking");
    try {
      const result = await checkForAppUpdate(buildInfo.version);
      if (result.kind === "unsupported") {
        toast.info(appUpdateUnsupportedMessage());
        return;
      }
      if (result.kind === "upToDate") {
        toast.success("当前已是最新版本");
        return;
      }
      if (result.kind === "error") {
        toast.error(result.message);
        return;
      }
      pendingUpdateRef.current = result.update;
      setUpdateDialogVersion(result.version);
      setUpdateDialogNotes(result.notes);
      setUpdateDialogOpen(true);
    } catch (e) {
      toast.error(mapAppUpdateError(e));
    } finally {
      setUpdateUiState("idle");
    }
  }, [buildInfo, updateBusy]);

  const cancelUpdateDialog = useCallback(() => {
    if (updateUiState === "installing") return;
    setUpdateDialogOpen(false);
    pendingUpdateRef.current = null;
  }, [updateUiState]);

  const confirmUpdateDialog = useCallback(async () => {
    const update = pendingUpdateRef.current;
    if (!update || updateUiState === "installing") return;
    setUpdateUiState("installing");
    try {
      await downloadAndInstallAppUpdate(update);
    } catch (e) {
      toast.error(mapAppUpdateError(e));
      setUpdateUiState("idle");
    }
  }, [updateUiState]);

  return (
    <div className={ENV_PANEL_PAGE_CLASS}>
      <section className={ENV_PANEL_SECTION_CLASS}>
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>关于</h3>
        <BrandLockup size="about" className="mb-4" />
        {buildInfoState === "error" ? (
          <p className={`m-0 ${PANEL_TYPOGRAPHY.body} text-notion-text-muted`}>{buildInfoError}</p>
        ) : buildInfo ? (
          <div className={`space-y-1.5 ${PANEL_TYPOGRAPHY.body}`}>
            <p className="m-0 text-notion-text">
              <strong className="font-medium">{buildInfo.productName}</strong>
              <span className="text-notion-text-muted"> · 版本 {buildInfo.version}</span>
            </p>
            <p className="m-0 text-notion-text-muted">{APP_COPYRIGHT}</p>
            <p className="m-0 text-notion-text-muted">
              本软件许可：商业许可（专有；全文见下方「许可正文」）
            </p>
            <p className="m-0 text-notion-text-muted">应用标识：{buildInfo.identifier}</p>
            <p className="m-0 text-notion-text-muted">
              运行环境：{formatPlatformLabel(buildInfo.platformOs, buildInfo.platformArch)}
              <span className="text-notion-text-muted"> · 壳 {buildInfo.shellProfile}</span>
            </p>
            {buildInfo.bundledSidecarBuild ? (
              <p className="m-0 break-all text-notion-text-muted">
                内置侧车构建：{buildInfo.bundledSidecarBuild}
              </p>
            ) : null}
            <p className="m-0 text-notion-text-muted">
              侧车托管：{buildInfo.asrShellManaged ? "应用内置（release）" : "外置 / dev 源码"}
            </p>
            {buildInfo.appDataRoot ? (
              <p className="m-0 break-all text-notion-text-muted">
                数据目录：{buildInfo.appDataRoot}
              </p>
            ) : null}
          </div>
        ) : (
          <p className={`m-0 ${PANEL_TYPOGRAPHY.body} text-notion-text-muted`}>加载中…</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={!buildInfo || copyBusy}
            onClick={() => void copyBuildInfo()}
          >
            <Copy className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            {copyBusy ? "复制中…" : "复制版本信息"}
          </button>
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={guideBusy}
            onClick={() => void openUserGuide()}
          >
            <ExternalLink
              className={LUCIDE_ICON_SIZE_SM}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
            {guideBusy ? "打开中…" : "打开随包说明文档"}
          </button>
          {isTauriRuntime() ? (
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={!buildInfo || updateBusy}
              onClick={() => void checkUpdates()}
            >
              <RefreshCw
                className={LUCIDE_ICON_SIZE_SM}
                strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                aria-hidden
              />
              {updateUiState === "checking"
                ? "检查中…"
                : updateUiState === "installing"
                  ? "安装中…"
                  : "检查更新"}
            </button>
          ) : null}
        </div>
        {isTauriRuntime() && buildInfo && !updateSupported ? (
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{appUpdateUnsupportedMessage()}</p>
        ) : null}
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          「复制版本信息」与诊断包内 build-info.txt 字段一致（英文键名，便于技术支持识别）。
        </p>
      </section>

      <section className={ENV_PANEL_SECTION_CLASS}>
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>第三方组件</h3>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          按组件列出名称、著作权、许可类型与来源；正式许可全文见下一节。
        </p>
        <LicenseProseBlock
          state={licensesState}
          error={licensesError}
          text={licenses?.notices ?? null}
        />
      </section>

      <section className={ENV_PANEL_SECTION_CLASS}>
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>许可正文</h3>
        <LicenseProseBlock
          state={licensesState}
          error={licensesError}
          text={licenses?.licenseTexts ?? null}
        />
      </section>

      <AppUpdateConfirmDialog
        open={updateDialogOpen}
        busy={updateUiState === "installing"}
        version={updateDialogVersion}
        notes={updateDialogNotes}
        onCancel={cancelUpdateDialog}
        onConfirm={() => void confirmUpdateDialog()}
      />
    </div>
  );
}

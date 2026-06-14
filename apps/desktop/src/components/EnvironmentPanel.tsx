import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Cloud, Cpu, Download, HelpCircle, Info, Keyboard, Sparkles } from "lucide-react";
import { ENV_STATUS_DOT_CLASS, type EnvStatusTone } from "./topBarStatusTone";
import { EnvProfileActions } from "./EnvProfileActions";
import { EnvLlmConfigPanel } from "./EnvLlmConfigPanel";
import { EnvLocalAsrPanel } from "./EnvLocalAsrPanel";
import { EnvOnlineSttPanel } from "./EnvOnlineSttPanel";
import { EnvEditorShortcutsPanel } from "./EnvEditorShortcutsPanel";
import { EnvAboutPanel } from "./EnvAboutPanel";
import { EnvHelpPanel } from "./EnvHelpPanel";
import { EnvQualityPanel } from "./EnvQualityPanel";
import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import { readOnlineSttEnvNavTone } from "../services/stt/readOnlineSttEnvNavPresentation";
import { STT_CONNECTION_VERIFIED_EVENT } from "../services/stt/sttOnlineProviderContract";
import { STT_ONLINE_RUNTIME_CHANGED_EVENT } from "../services/stt/sttOnlineRuntimeNotify";
import type { AsrHealthCapabilities, AsrModelCacheInfo, BundledAsrLaunchReport, WaveformPeaksCacheInfo } from "../tauri/projectApi";
import type { AsrSetupControllerApi } from "../pages/useAsrSetupController";
import type { LocalAsrModelCatalogApi } from "../pages/useLocalAsrModelCatalog";
import type { PrepareModelApi } from "../pages/usePrepareModelController";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { resolveEnvironmentFocusSection } from "../utils/environmentPanelFocus";

type EnvNavId = "local-asr" | "online-stt" | "llm" | "profile" | "shortcuts" | "quality" | "about" | "help";

function envNavStatusDotClass(tone: EnvStatusTone): string {
  return ENV_STATUS_DOT_CLASS[tone];
}

const ENV_NAV_BTN_BASE =
  "mb-1 flex w-full appearance-none items-center border-0 px-4 py-3 text-left shadow-none outline-none transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30";

type EnvNavItem = {
  id: EnvNavId;
  label: string;
  description: string;
  icon: React.ReactNode;
  /** 与下方说明类条目贴底（在「使用说明」首项上加 mt-auto） */
  pinBottom?: boolean;
};

/** 顺序：转写能力 → 编辑 → 数据/维护 → 说明与关于（贴底） */
const ENV_NAV_ITEMS: EnvNavItem[] = [
  { id: "local-asr", label: "本机 ASR", description: "侧车、模型与诊断", icon: <Cpu className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
  { id: "online-stt", label: "在线 STT", description: "厂商与 API Key", icon: <Cloud className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
  { id: "llm", label: "LLM 配置", description: "云端或本机 Ollama", icon: <Sparkles className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
  { id: "shortcuts", label: "快捷键", description: "编辑器键盘操作", icon: <Keyboard className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
  { id: "profile", label: "配置迁移", description: "导入 / 导出偏好", icon: <Download className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
  { id: "quality", label: "质量评测", description: "CER / 发版门禁", icon: <BarChart3 className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
  { id: "help", label: "使用说明", description: "转写流程与 FAQ", icon: <HelpCircle className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />, pinBottom: true },
  { id: "about", label: "关于", description: "版本与第三方许可", icon: <Info className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
];

export type EnvironmentPanelProps = {
  asrPresentation: AsrEnvPresentation;
  asrHealthDetail: string;
  bundledAsrDiag: BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  asrModelCacheInfo: AsrModelCacheInfo | null;
  waveformPeaksCacheInfo: WaveformPeaksCacheInfo | null;
  asrModelCacheBusy: boolean;
  asrCacheMessage: string;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelCancelling: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  prepareDefaultFunasrModel: PrepareModelApi["prepareDefaultFunasrModel"];
  cancelPrepareModel: () => void;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  clearOrphanWaveformPeaksCache: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  asrSetup: AsrSetupControllerApi;
  localAsrModelCatalog: LocalAsrModelCatalogApi;
  onSttOnlineRuntimeChanged?: () => void;
  onLlmRuntimeChanged?: () => void;
  focusLocalAsrSeq?: number;
  focusOnlineSttSeq?: number;
  focusLlmSeq?: number;
  llmStatusRefreshSeq?: number;
};

export function EnvironmentPanel({
  asrPresentation,
  bundledAsrDiag,
  asrCaps,
  asrModelCacheInfo,
  waveformPeaksCacheInfo,
  asrModelCacheBusy,
  asrCacheMessage,
  funasrInstallMessage,
  prepareModelBusy,
  prepareModelCancelling,
  prepareModelProgress,
  prepareModelFailure,
  busy,
  refreshAsrHealth,
  copyFunasrManualCommands,
  prepareDefaultFunasrModel,
  cancelPrepareModel,
  refreshAsrModelCacheInfo,
  clearAsrModelCache,
  clearOrphanWaveformPeaksCache,
  retryBundledAsrSidecar,
  openAppDataFolder,
  exportDiagnosticBundle,
  asrSetup,
  localAsrModelCatalog,
  onSttOnlineRuntimeChanged,
  onLlmRuntimeChanged,
  focusLocalAsrSeq = 0,
  focusOnlineSttSeq = 0,
  focusLlmSeq = 0,
  llmStatusRefreshSeq = 0,
}: EnvironmentPanelProps) {
  const [envSection, setEnvSection] = useState<EnvNavId>("local-asr");
  const [settingsEpoch, setSettingsEpoch] = useState(0);
  const [sttNavRefreshSeq, setSttNavRefreshSeq] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onlineSttScrollRef = useRef<HTMLDivElement | null>(null);
  const llmScrollRef = useRef<HTMLDivElement | null>(null);
  const [layoutCompact, setLayoutCompact] = useState(false);
  const { presentation: llmPresentation } = useLlmEnvStatus(llmStatusRefreshSeq);

  const bumpSttRuntimeRevision = useCallback(() => {
    setSttNavRefreshSeq((n) => n + 1);
    onSttOnlineRuntimeChanged?.();
  }, [onSttOnlineRuntimeChanged]);

  const onlineSttNavTone = useMemo(
    () => readOnlineSttEnvNavTone(),
    [settingsEpoch, sttNavRefreshSeq],
  );

  useEffect(() => {
    const onConnectionVerifiedChange = () => {
      setSttNavRefreshSeq((n) => n + 1);
    };
    window.addEventListener(STT_CONNECTION_VERIFIED_EVENT, onConnectionVerifiedChange);
    window.addEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, onConnectionVerifiedChange);
    return () => {
      window.removeEventListener(STT_CONNECTION_VERIFIED_EVENT, onConnectionVerifiedChange);
      window.removeEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, onConnectionVerifiedChange);
    };
  }, []);

  useEffect(() => {
    const section = resolveEnvironmentFocusSection({
      focusLocalAsrSeq,
      focusOnlineSttSeq,
      focusLlmSeq,
    });
    if (!section) return;
    setEnvSection(section);
    if (section === "online-stt") {
      const raf = window.requestAnimationFrame(() => {
        onlineSttScrollRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      return () => window.cancelAnimationFrame(raf);
    }
    if (section === "llm") {
      const raf = window.requestAnimationFrame(() => {
        llmScrollRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      return () => window.cancelAnimationFrame(raf);
    }
  }, [focusLocalAsrSeq, focusOnlineSttSeq, focusLlmSeq]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const updateLayout = () => {
      const width = root.getBoundingClientRect().width;
      setLayoutCompact(width > 0 && width < 720);
    };

    updateLayout();
    const ro = new ResizeObserver(updateLayout);
    ro.observe(root);

    return () => {
      ro.disconnect();
    };
  }, []);

  const navWidthClass = layoutCompact ? "w-48" : "w-60";
  const mainPaddingClass = layoutCompact ? "px-4 py-4" : "px-6 py-5";

  return (
    <div ref={rootRef} className="workspace h-full min-h-0 min-w-0 overflow-hidden bg-notion-bg">
      <div className="flex h-full min-h-0 flex-row bg-notion-bg">
          {/* 左侧导航 */}
          <nav className={`flex h-full ${navWidthClass} shrink-0 flex-col overflow-y-auto border-r border-notion-divider bg-notion-sidebar py-5`}>
            <div className="flex flex-1 flex-col">
            {ENV_NAV_ITEMS.map((item) => {
              const active = envSection === item.id;
              const statusTone: EnvStatusTone | null =
                item.id === "local-asr"
                  ? asrPresentation.tone
                  : item.id === "online-stt"
                    ? onlineSttNavTone
                    : item.id === "llm"
                      ? llmPresentation.tone
                      : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${ENV_NAV_BTN_BASE} ${item.pinBottom ? "mt-auto" : ""} ${
                    active
                      ? "border-l-4 border-zen-saffron bg-notion-sidebar-active text-notion-text"
                      : "border-l-4 border-transparent bg-transparent text-notion-text-muted hover:bg-notion-sidebar-hover"
                  }`}
                  aria-current={active ? "true" : undefined}
                  onClick={() => setEnvSection(item.id)}
                >
                  <span className={`mr-3 shrink-0 ${active ? "text-notion-text" : "text-notion-text-muted"}`}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] leading-snug ${active ? "font-bold text-notion-text" : "font-medium text-notion-text"}`}>
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] leading-tight text-notion-text-muted">
                      {item.description}
                    </span>
                  </span>
                  {statusTone ? (
                    <span
                      className={`ml-2 h-1.5 w-1.5 shrink-0 rounded-full ${envNavStatusDotClass(statusTone)}`}
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
            </div>
          </nav>

          {/* 右侧内容 */}
          <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto bg-notion-bg ${mainPaddingClass}`}>
            <div className="flex flex-col gap-6">
              {envSection === "local-asr" ? (
                <EnvLocalAsrPanel
                  asrPresentation={asrPresentation}
                  bundledAsrDiag={bundledAsrDiag}
                  asrCaps={asrCaps}
                  asrModelCacheInfo={asrModelCacheInfo}
                  waveformPeaksCacheInfo={waveformPeaksCacheInfo}
                  asrModelCacheBusy={asrModelCacheBusy}
                  asrCacheMessage={asrCacheMessage}
                  funasrInstallMessage={funasrInstallMessage}
                  prepareModelBusy={prepareModelBusy}
                  prepareModelCancelling={prepareModelCancelling}
                  prepareModelProgress={prepareModelProgress}
                  prepareModelFailure={prepareModelFailure}
                  busy={busy}
                  refreshAsrHealth={refreshAsrHealth}
                  copyFunasrManualCommands={copyFunasrManualCommands}
                  prepareDefaultFunasrModel={prepareDefaultFunasrModel}
                  cancelPrepareModel={cancelPrepareModel}
                  refreshAsrModelCacheInfo={refreshAsrModelCacheInfo}
                  clearAsrModelCache={clearAsrModelCache}
                  clearOrphanWaveformPeaksCache={clearOrphanWaveformPeaksCache}
                  retryBundledAsrSidecar={retryBundledAsrSidecar}
                  openAppDataFolder={openAppDataFolder}
                  exportDiagnosticBundle={exportDiagnosticBundle}
                  asrSetup={asrSetup}
                  localAsrModelCatalog={localAsrModelCatalog}
                />
              ) : null}

              {envSection === "online-stt" ? (
                <EnvOnlineSttPanel
                  key={`online-stt-${settingsEpoch}`}
                  scrollAnchorRef={onlineSttScrollRef}
                  busy={busy}
                  onSttOnlineRuntimeChanged={bumpSttRuntimeRevision}
                />
              ) : null}

              {envSection === "llm" ? (
                <EnvLlmConfigPanel
                  key={`llm-${settingsEpoch}`}
                  scrollAnchorRef={llmScrollRef}
                  busy={busy}
                  onLlmRuntimeChanged={onLlmRuntimeChanged}
                />
              ) : null}

              {envSection === "profile" ? (
                <EnvProfileActions
                  busy={busy}
                  onImported={() => {
                    setSettingsEpoch((n) => n + 1);
                    bumpSttRuntimeRevision();
                    onLlmRuntimeChanged?.();
                  }}
                />
              ) : null}

              {envSection === "shortcuts" ? <EnvEditorShortcutsPanel /> : null}

              {envSection === "quality" ? <EnvQualityPanel busy={busy} /> : null}

              {envSection === "about" ? <EnvAboutPanel /> : null}

              {envSection === "help" ? <EnvHelpPanel /> : null}
            </div>
          </main>
        </div>
    </div>
  );
}

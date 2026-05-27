import { useEffect, useRef, useState } from "react";
import { Cloud, Cpu, Download, HelpCircle, Sparkles } from "lucide-react";
import { EnvProfileActions } from "./EnvProfileActions";
import { EnvLlmConfigPanel } from "./EnvLlmConfigPanel";
import { EnvLocalAsrPanel } from "./EnvLocalAsrPanel";
import { EnvOnlineSttPanel } from "./EnvOnlineSttPanel";
import { EnvHelpPanel } from "./EnvHelpPanel";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { AsrHealthCapabilities, AsrModelCacheInfo, BundledAsrLaunchReport } from "../tauri/projectApi";
import type { AsrHealthState } from "../pages/useProjectController";
import type { AsrSetupControllerApi } from "../pages/useAsrSetupController";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type EnvNavId = "local-asr" | "online-stt" | "llm" | "profile" | "help";

const ENV_NAV_ITEMS: { id: EnvNavId; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "local-asr", label: "本机 ASR", description: "FunASR 环境、模型下载与诊断", icon: <Cpu className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
  { id: "online-stt", label: "在线 STT", description: "在线转写提供方与 API 配置", icon: <Cloud className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
  { id: "llm", label: "LLM 配置", description: "远程大模型连接与密钥", icon: <Sparkles className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
  { id: "profile", label: "配置迁移", description: "环境配置导入、导出与迁移", icon: <Download className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
  { id: "help", label: "使用说明", description: "快捷键、常见问题与导出格式", icon: <HelpCircle className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> },
];

export type EnvironmentPanelProps = {
  asrHealth: AsrHealthState;
  asrHealthDetail: string;
  bundledAsrDiag: BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  asrModelCacheInfo: AsrModelCacheInfo | null;
  asrModelCacheBusy: boolean;
  asrCacheMessage: string;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  prepareDefaultFunasrModel: () => Promise<void>;
  cancelPrepareModel: () => void;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  asrSetup: AsrSetupControllerApi;
  onSttOnlineRuntimeChanged?: () => void;
  focusOnlineSttSeq?: number;
};

export function EnvironmentPanel({
  asrHealth,
  asrHealthDetail,
  bundledAsrDiag,
  asrCaps,
  asrModelCacheInfo,
  asrModelCacheBusy,
  asrCacheMessage,
  funasrInstallMessage,
  prepareModelBusy,
  prepareModelProgress,
  prepareModelFailure,
  busy,
  refreshAsrHealth,
  installFunasrDepsInteractive,
  copyFunasrManualCommands,
  prepareDefaultFunasrModel,
  cancelPrepareModel,
  refreshAsrModelCacheInfo,
  clearAsrModelCache,
  retryBundledAsrSidecar,
  openAppDataFolder,
  exportDiagnosticBundle,
  asrSetup,
  onSttOnlineRuntimeChanged,
  focusOnlineSttSeq = 0,
}: EnvironmentPanelProps) {
  const [envSection, setEnvSection] = useState<EnvNavId>("local-asr");
  const [settingsEpoch, setSettingsEpoch] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [panelScale, setPanelScale] = useState(1);

  useEffect(() => {
    if (focusOnlineSttSeq <= 0) return;
    setEnvSection("online-stt");
    const raf = window.requestAnimationFrame(() => {
      document.getElementById("online-stt-provider")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [focusOnlineSttSeq]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const baseWidth = 860;
    const baseHeight = 620;

    const updateScale = () => {
      const rect = root.getBoundingClientRect();
      const widthScale = rect.width / baseWidth;
      const heightScale = rect.height / baseHeight;
      const next = Math.min(widthScale, heightScale);
      if (!Number.isFinite(next) || next <= 0) {
        setPanelScale(1);
        return;
      }
      setPanelScale(Math.min(1.35, Math.max(0.72, next)));
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(root);

    return () => {
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className="h-full min-h-0 min-w-0 overflow-hidden bg-notion-bg">
      <div
        className="h-full origin-top-left"
        style={{
          transform: `scale(${panelScale})`,
          width: `${100 / panelScale}%`,
          height: `${100 / panelScale}%`,
        }}
      >
        <div className="flex h-full min-h-0 flex-row bg-notion-bg">
          {/* 左侧导航 */}
          <nav className="flex h-full w-[clamp(112px,22%,156px)] shrink-0 flex-col gap-1 overflow-y-auto border-r border-notion-divider bg-notion-sidebar px-2 py-4">
            {ENV_NAV_ITEMS.map((item) => {
              const active = envSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex w-full flex-col gap-0.5 rounded border px-2 py-2 text-left outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30 ${
                    active
                      ? "border-notion-border bg-notion-sidebar-active text-notion-text"
                      : "border-transparent bg-transparent text-notion-text hover:bg-notion-sidebar-hover"
                  }`}
                  aria-current={active ? "true" : undefined}
                  onClick={() => setEnvSection(item.id)}
                >
                  <span className="flex items-center gap-2 text-notion-text">
                    {item.icon}
                    <span className={PANEL_TYPOGRAPHY.navLabel}>{item.label}</span>
                  </span>
                  <span className={PANEL_TYPOGRAPHY.navDescription}>{item.description}</span>
                </button>
              );
            })}
          </nav>

          {/* 右侧内容 */}
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-notion-bg p-[clamp(12px,2.4vw,30px)]">
            <div className="flex flex-col gap-6">
              {envSection === "local-asr" ? (
                <EnvLocalAsrPanel
                  asrHealth={asrHealth}
                  asrHealthDetail={asrHealthDetail}
                  bundledAsrDiag={bundledAsrDiag}
                  asrCaps={asrCaps}
                  asrModelCacheInfo={asrModelCacheInfo}
                  asrModelCacheBusy={asrModelCacheBusy}
                  asrCacheMessage={asrCacheMessage}
                  funasrInstallMessage={funasrInstallMessage}
                  prepareModelBusy={prepareModelBusy}
                  prepareModelProgress={prepareModelProgress}
                  prepareModelFailure={prepareModelFailure}
                  busy={busy}
                  refreshAsrHealth={refreshAsrHealth}
                  installFunasrDepsInteractive={installFunasrDepsInteractive}
                  copyFunasrManualCommands={copyFunasrManualCommands}
                  prepareDefaultFunasrModel={prepareDefaultFunasrModel}
                  cancelPrepareModel={cancelPrepareModel}
                  refreshAsrModelCacheInfo={refreshAsrModelCacheInfo}
                  clearAsrModelCache={clearAsrModelCache}
                  retryBundledAsrSidecar={retryBundledAsrSidecar}
                  openAppDataFolder={openAppDataFolder}
                  exportDiagnosticBundle={exportDiagnosticBundle}
                  asrSetup={asrSetup}
                />
              ) : null}

              {envSection === "online-stt" ? (
                <EnvOnlineSttPanel
                  key={`online-stt-${settingsEpoch}`}
                  busy={busy}
                  onSttOnlineRuntimeChanged={onSttOnlineRuntimeChanged}
                />
              ) : null}

              {envSection === "llm" ? <EnvLlmConfigPanel key={`llm-${settingsEpoch}`} busy={busy} /> : null}

              {envSection === "profile" ? (
                <EnvProfileActions
                  busy={busy}
                  onImported={() => {
                    setSettingsEpoch((n) => n + 1);
                    onSttOnlineRuntimeChanged?.();
                  }}
                />
              ) : null}

              {envSection === "help" ? <EnvHelpPanel /> : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

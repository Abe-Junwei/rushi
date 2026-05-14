import { useEffect, useState } from "react";
import { P1EnvLocalAsrPanel } from "./P1EnvLocalAsrPanel";
import { P1EnvOnlineSttPanel } from "./P1EnvOnlineSttPanel";
import { P1EnvHelpPanel } from "./P1EnvHelpPanel";
import type { AsrHealthCapabilities, BundledAsrLaunchReport } from "../tauri/p1Api";
import type { AsrHealthState } from "../pages/useProjectP1Controller";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";

/** 左侧导航分区（类系统设置 / IDE Settings：导航 + 详情） */
type EnvNavId = "local-asr" | "online-stt" | "help";

const ENV_NAV_ITEMS: { id: EnvNavId; label: string }[] = [
  { id: "local-asr", label: "本机 ASR" },
  { id: "online-stt", label: "在线 STT" },
  { id: "help", label: "使用说明" },
];

export type P1EnvironmentPanelProps = {
  asrHealth: AsrHealthState;
  asrHealthDetail: string;
  bundledAsrDiag: BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  prepareDefaultFunasrModel: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  onSttOnlineRuntimeChanged?: () => void;
  /** 递增时切换到「在线 STT」分区并滚动到锚点（顶栏 / 侧栏入口）。 */
  focusOnlineSttSeq?: number;
};

export function P1EnvironmentPanel({
  asrHealth,
  asrHealthDetail,
  bundledAsrDiag,
  asrCaps,
  funasrInstallMessage,
  prepareModelBusy,
  prepareModelProgress,
  prepareModelFailure,
  busy,
  refreshAsrHealth,
  installFunasrDepsInteractive,
  copyFunasrManualCommands,
  prepareDefaultFunasrModel,
  retryBundledAsrSidecar,
  openAppDataFolder,
  onSttOnlineRuntimeChanged,
  focusOnlineSttSeq = 0,
}: P1EnvironmentPanelProps) {
  const [envSection, setEnvSection] = useState<EnvNavId>("local-asr");

  useEffect(() => {
    if (focusOnlineSttSeq <= 0) return;
    setEnvSection("online-stt");
    const raf = window.requestAnimationFrame(() => {
      document.getElementById("p1-online-stt-provider")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [focusOnlineSttSeq]);

  return (
    <div className="flex min-h-0 min-w-0 flex-col border-t border-zen-gray-300 bg-zen-paper">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:flex-row">
        <nav
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-zen-gray-300 bg-zen-ochre px-2 py-2 sm:w-[7.75rem] sm:flex-col sm:gap-0.5 sm:border-b-0 sm:border-r sm:border-zen-gray-300 sm:bg-zen-ochre sm:px-1 sm:py-2"
          aria-label="环境与 ASR 分区"
        >
          {ENV_NAV_ITEMS.map((item) => {
            const active = envSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`rounded-md px-2 py-2 text-left text-[11px] font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-ink/20 sm:w-full ${
                  active ? "bg-zen-paper text-zen-ink" : "text-zen-stone hover:bg-zen-gray-300/70 hover:text-zen-ink"
                }`}
                aria-current={active ? "true" : undefined}
                onClick={() => setEnvSection(item.id)}
              >
                <span className="whitespace-nowrap sm:whitespace-normal">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-3 text-[12px] leading-relaxed text-zen-stone">
          {envSection === "local-asr" ? (
            <P1EnvLocalAsrPanel
              asrHealth={asrHealth}
              asrHealthDetail={asrHealthDetail}
              bundledAsrDiag={bundledAsrDiag}
              asrCaps={asrCaps}
              funasrInstallMessage={funasrInstallMessage}
              prepareModelBusy={prepareModelBusy}
              prepareModelProgress={prepareModelProgress}
              prepareModelFailure={prepareModelFailure}
              busy={busy}
              refreshAsrHealth={refreshAsrHealth}
              installFunasrDepsInteractive={installFunasrDepsInteractive}
              copyFunasrManualCommands={copyFunasrManualCommands}
              prepareDefaultFunasrModel={prepareDefaultFunasrModel}
              retryBundledAsrSidecar={retryBundledAsrSidecar}
              openAppDataFolder={openAppDataFolder}
            />
          ) : null}

          {envSection === "online-stt" ? (
            <P1EnvOnlineSttPanel busy={busy} onSttOnlineRuntimeChanged={onSttOnlineRuntimeChanged} />
          ) : null}

          {envSection === "help" ? <P1EnvHelpPanel /> : null}
        </div>
      </div>
    </div>
  );
}

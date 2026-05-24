import { useEffect, useState } from "react";
import { EnvLocalAsrPanel } from "./EnvLocalAsrPanel";
import { EnvOnlineSttPanel } from "./EnvOnlineSttPanel";
import { EnvHelpPanel } from "./EnvHelpPanel";
import type { AsrHealthCapabilities, BundledAsrLaunchReport } from "../tauri/projectApi";
import type { AsrHealthState } from "../pages/useProjectController";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";

type EnvNavId = "local-asr" | "online-stt" | "help";

const ENV_NAV_ITEMS: { id: EnvNavId; label: string; description: string }[] = [
  { id: "local-asr", label: "本机 ASR", description: "FunASR 环境、模型下载与诊断" },
  { id: "online-stt", label: "在线 STT", description: "在线转写提供方与 API 配置" },
  { id: "help", label: "使用说明", description: "快捷键、常见问题与导出格式" },
];

export type EnvironmentPanelProps = {
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
  focusOnlineSttSeq?: number;
};

export function EnvironmentPanel({
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
}: EnvironmentPanelProps) {
  const [envSection, setEnvSection] = useState<EnvNavId>("local-asr");

  useEffect(() => {
    if (focusOnlineSttSeq <= 0) return;
    setEnvSection("online-stt");
    const raf = window.requestAnimationFrame(() => {
      document.getElementById("online-stt-provider")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [focusOnlineSttSeq]);

  const activeItem = ENV_NAV_ITEMS.find((i) => i.id === envSection);

  return (
    <div className="flex h-full flex-row">
      {/* 左侧导航 */}
      <nav className="flex h-full w-44 shrink-0 flex-col border-r border-zen-gray-300 bg-serene-surface-container-low px-2 py-4">
        <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-zen-stone">
          设置
        </p>
        {ENV_NAV_ITEMS.map((item) => {
          const active = envSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`mb-0.5 flex w-full flex-col rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-ink/20 ${
                active
                  ? "bg-zen-paper text-zen-ink shadow-sm"
                  : "text-zen-stone hover:bg-zen-paper hover:text-zen-ink"
              }`}
              aria-current={active ? "true" : undefined}
              onClick={() => setEnvSection(item.id)}
            >
              <span className="text-[12px] font-medium">{item.label}</span>
              <span className="mt-0.5 text-[10px] leading-snug text-zen-stone/80">{item.description}</span>
            </button>
          );
        })}
      </nav>

      {/* 右侧内容 */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-zen-paper px-6 py-5">
        <div className="mb-5">
          <h2 className="font-serif text-xl font-medium text-zen-ink">{activeItem?.label}</h2>
          <p className="mt-1 text-[12px] text-zen-stone">{activeItem?.description}</p>
        </div>

        <div className="space-y-4">
          {envSection === "local-asr" ? (
            <EnvLocalAsrPanel
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
            <EnvOnlineSttPanel busy={busy} onSttOnlineRuntimeChanged={onSttOnlineRuntimeChanged} />
          ) : null}

          {envSection === "help" ? <EnvHelpPanel /> : null}
        </div>
      </div>
    </div>
  );
}

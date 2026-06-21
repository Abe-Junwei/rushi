import { useCallback, useEffect, useRef, useState } from "react";
import { EnvProfileActions } from "./EnvProfileActions";
import { EnvLlmConfigPanel } from "./EnvLlmConfigPanel";
import { EnvLocalAsrPanel } from "./EnvLocalAsrPanel";
import { EnvOnlineSttPanel } from "./EnvOnlineSttPanel";
import { EnvEditorShortcutsPanel } from "./EnvEditorShortcutsPanel";
import { EnvAboutPanel } from "./EnvAboutPanel";
import { EnvPreferencesPanel } from "./EnvPreferencesPanel";
import { EnvQualityPanel } from "./EnvQualityPanel";
import { EnvironmentPanelNav } from "./EnvironmentPanelNav";
import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import { useLlmKeychainReady } from "../hooks/useLlmKeychainReady";
import { useOnlineSttEnvNavTone } from "../hooks/useOnlineSttEnvNavTone";
import { isLlmRuntimeReady } from "../services/postprocess/postprocessRuntimeContract";
import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import type { AsrHealthCapabilities, AsrModelCacheInfo, BundledAsrLaunchReport, WaveformPeaksCacheInfo } from "../tauri/projectApi";
import type { AsrSetupControllerApi } from "../pages/useAsrSetupController";
import type { LocalAsrModelCatalogApi } from "../pages/useLocalAsrModelCatalog";
import type { PrepareModelApi } from "../pages/usePrepareModelController";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";
import { resolveEnvironmentFocusSection } from "../utils/environmentPanelFocus";
import { envMainPaddingClass, type EnvNavId } from "../utils/environmentPanelNav";

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
  offlinePackImportBusy?: boolean;
  offlinePackImportProgress?: number;
  offlinePackImportFailure?: string | null;
  importOfflineAsrModelsPack?: () => Promise<void>;
  cancelOfflineAsrModelsPackImport?: () => Promise<void>;
  openOfflineAsrModelsPackReleasePage?: () => Promise<void>;
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
  offlinePackImportBusy,
  offlinePackImportProgress,
  offlinePackImportFailure,
  importOfflineAsrModelsPack,
  cancelOfflineAsrModelsPackImport,
  openOfflineAsrModelsPackReleasePage,
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onlineSttScrollRef = useRef<HTMLDivElement | null>(null);
  const llmScrollRef = useRef<HTMLDivElement | null>(null);
  const [layoutCompact, setLayoutCompact] = useState(false);
  const { keychainReady: llmKeychainReady, checking: llmKeychainChecking } =
    useLlmKeychainReady(llmStatusRefreshSeq);
  const { presentation: llmPresentation } = useLlmEnvStatus(llmStatusRefreshSeq, {
    hasLocalKeyRef: isLlmRuntimeReady(),
    hasTypedKey: false,
    keychainPresent: llmKeychainChecking ? null : llmKeychainReady,
  });

  const bumpSttRuntimeRevision = useCallback(() => {
    setSettingsEpoch((n) => n + 1);
    onSttOnlineRuntimeChanged?.();
  }, [onSttOnlineRuntimeChanged]);

  const onlineSttNavTone = useOnlineSttEnvNavTone(settingsEpoch);

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
        onlineSttScrollRef.current?.scrollIntoView({ block: "nearest" });
      });
      return () => window.cancelAnimationFrame(raf);
    }
    if (section === "llm") {
      const raf = window.requestAnimationFrame(() => {
        llmScrollRef.current?.scrollIntoView({ block: "start" });
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

  const mainPaddingClass = envMainPaddingClass(layoutCompact);

  return (
    <div ref={rootRef} className="workspace h-full min-h-0 min-w-0 overflow-hidden bg-notion-bg">
      <div className="flex h-full min-h-0 flex-row bg-notion-bg">
        <EnvironmentPanelNav
          envSection={envSection}
          layoutCompact={layoutCompact}
          asrNavTone={asrPresentation.tone}
          onlineSttNavTone={onlineSttNavTone}
          llmNavTone={llmPresentation.tone}
          onSelectSection={setEnvSection}
        />

        <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto bg-notion-bg ${mainPaddingClass}`}>
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
                offlinePackImportBusy={offlinePackImportBusy}
                offlinePackImportProgress={offlinePackImportProgress}
                offlinePackImportFailure={offlinePackImportFailure}
                importOfflineAsrModelsPack={importOfflineAsrModelsPack}
                cancelOfflineAsrModelsPackImport={cancelOfflineAsrModelsPackImport}
                openOfflineAsrModelsPackReleasePage={openOfflineAsrModelsPackReleasePage}
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

            {envSection === "preferences" ? <EnvPreferencesPanel /> : null}

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
        </main>
      </div>
    </div>
  );
}

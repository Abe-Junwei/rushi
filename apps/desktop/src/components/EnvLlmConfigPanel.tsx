import type { Ref } from "react";
import { useEnvLlmConfigPanel } from "../hooks/useEnvLlmConfigPanel";
import { ENV_PANEL_CONFIG_FLOW_CLASS } from "../utils/environmentPanelNav";
import { EnvFlatConfigStack } from "./EnvFlatConfigStack";
import { EnvLlmCloudVendorPills } from "./EnvLlmCloudVendorPills";
import { EnvLlmConnectionForm } from "./EnvLlmConnectionForm";
import { EnvLlmModeSwitch } from "./EnvLlmModeSwitch";
import { EnvLlmPromptSection } from "./EnvLlmPromptSection";
import { EnvLlmStatusBanner } from "./EnvLlmStatusBanner";

type Props = {
  busy: boolean;
  scrollAnchorRef?: Ref<HTMLDivElement>;
  onLlmRuntimeChanged?: () => void;
};

export function EnvLlmConfigPanel({ busy, scrollAnchorRef, onLlmRuntimeChanged }: Props) {
  const panel = useEnvLlmConfigPanel({ busy, onLlmRuntimeChanged });

  const formProps = {
    llmEnvMode: panel.llmEnvMode,
    formBusy: panel.formBusy,
    localLoopback: panel.localLoopback,
    providerId: panel.providerId,
    baseUrl: panel.baseUrl,
    model: panel.model,
    apiKey: panel.apiKey,
    savedApiKeyId: panel.savedApiKeyId,
    def: panel.def,
    onProviderChange: panel.onProviderChange,
    setBaseUrl: panel.setBaseUrl,
    setModel: panel.setModel,
    setApiKey: panel.setApiKey,
    invalidateProbe: panel.invalidateProbe,
    save: panel.save,
    clearSavedApiKey: panel.clearSavedApiKey,
    keychainChecking: panel.keychainChecking,
    keychainReady: panel.keychainReady,
  };

  return (
    <div id="llm-config" ref={scrollAnchorRef} className={ENV_PANEL_CONFIG_FLOW_CLASS}>
      <EnvLlmModeSwitch
        mode={panel.llmEnvMode}
        localTone={panel.modeToggleTones.local}
        cloudTone={panel.modeToggleTones.cloud}
        disabled={panel.formBusy}
        onSelectLocal={panel.selectLocalMode}
        onSelectCloud={panel.selectCloudMode}
      />

      <EnvFlatConfigStack
        middle={
          panel.llmEnvMode === "cloud" ? (
            <EnvLlmCloudVendorPills
              providerId={panel.providerId}
              disabled={panel.formBusy}
              onProviderChange={panel.onProviderChange}
            />
          ) : undefined
        }
        banner={
          <EnvLlmStatusBanner
            presentation={panel.presentation}
            disabled={panel.formBusy}
            busy={panel.llmEnvMode === "local" ? panel.detectBusy : panel.probeBusy}
            refreshLabel={panel.llmEnvMode === "local" ? "刷新 Ollama 检测" : "探测连接"}
            onRefresh={() => {
              if (panel.llmEnvMode === "local") void panel.refreshDetect();
              else void panel.probe();
            }}
          />
        }
        form={<EnvLlmConnectionForm {...formProps} />}
      />

      <EnvLlmPromptSection disabled={panel.formBusy} prompt={panel.promptConfig} />
    </div>
  );
}

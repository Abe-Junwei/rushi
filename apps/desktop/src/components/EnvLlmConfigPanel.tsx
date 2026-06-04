import { PANEL_TYPOGRAPHY } from "../config/typography";
import { useEnvLlmConfigPanel } from "../hooks/useEnvLlmConfigPanel";
import { EnvLlmCapabilitiesSection } from "./EnvLlmCapabilitiesSection";
import { EnvLlmConnectionForm } from "./EnvLlmConnectionForm";
import { EnvLlmModeSwitch } from "./EnvLlmModeSwitch";
import { EnvLlmStatusBanner } from "./EnvLlmStatusBanner";

type Props = {
  busy: boolean;
  onLlmRuntimeChanged?: () => void;
};

export function EnvLlmConfigPanel({ busy, onLlmRuntimeChanged }: Props) {
  const panel = useEnvLlmConfigPanel({ busy, onLlmRuntimeChanged });

  return (
    <div id="llm-config" className="flex max-w-2xl flex-col gap-6">
      <header className="space-y-2">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>LLM 配置</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>
          管理<strong className="font-medium text-notion-text">云端</strong>或
          <strong className="font-medium text-notion-text">本机 Ollama</strong>文本模型（OpenAI 兼容{" "}
          <code className={PANEL_TYPOGRAPHY.code}>/v1/chat/completions</code>）。转写仍走本机 ASR / 在线 STT。
        </p>
        <p className={PANEL_TYPOGRAPHY.body}>
          语段正文仅在触发具体能力时发送；不会静默改写文稿。本机 Ollama 模式下数据不出本机；云端模式请求发往所选厂商。
        </p>
      </header>

      <EnvLlmModeSwitch
        mode={panel.llmEnvMode}
        disabled={panel.formBusy}
        onSelectLocal={panel.selectLocalMode}
        onSelectCloud={panel.selectCloudMode}
      />

      <EnvLlmStatusBanner
        presentation={panel.presentation}
        disabled={panel.formBusy}
        busy={panel.detectBusy}
        onRefresh={() => void panel.refreshDetect()}
      />

      <EnvLlmCapabilitiesSection presentation={panel.presentation} />

      <EnvLlmConnectionForm
        llmEnvMode={panel.llmEnvMode}
        formBusy={panel.formBusy}
        localLoopback={panel.localLoopback}
        providerId={panel.providerId}
        baseUrl={panel.baseUrl}
        model={panel.model}
        apiKey={panel.apiKey}
        savedApiKeyId={panel.savedApiKeyId}
        def={panel.def}
        probeBusy={panel.probeBusy}
        probeFailed={panel.probeFailed}
        msg={panel.msg}
        onProviderChange={panel.onProviderChange}
        setBaseUrl={panel.setBaseUrl}
        setModel={panel.setModel}
        setApiKey={panel.setApiKey}
        invalidateProbe={panel.invalidateProbe}
        save={panel.save}
        probe={panel.probe}
        clearSavedApiKey={panel.clearSavedApiKey}
        keychainChecking={panel.keychainChecking}
        keychainReady={panel.keychainReady}
      />
    </div>
  );
}

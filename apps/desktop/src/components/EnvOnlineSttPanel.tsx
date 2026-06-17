import { Info } from "lucide-react";
import type { Ref } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { sttKeychainReferenceMessage } from "../services/stt/sttConnectionUi";
import { normalizeSttApiKeyId } from "../services/stt/sttOnlineProviderContract";
import { useEnvOnlineSttPanel } from "../hooks/useEnvOnlineSttPanel";
import { EnvLlmStatusBanner } from "./EnvLlmStatusBanner";
import { EnvOnlineSttConfigCard } from "./envOnlineStt/EnvOnlineSttConfigCard";
import { OnlineSttProviderPicker } from "./envOnlineStt/OnlineSttProviderPicker";
import { OnlineSttRuntimeForm } from "./envOnlineStt/OnlineSttRuntimeForm";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type Props = {
  busy: boolean;
  scrollAnchorRef?: Ref<HTMLDivElement>;
  onSttOnlineRuntimeChanged?: () => void;
};

export function EnvOnlineSttPanel({ busy, scrollAnchorRef, onSttOnlineRuntimeChanged }: Props) {
  const panel = useEnvOnlineSttPanel({ busy, onSttOnlineRuntimeChanged });

  return (
    <div id="online-stt-provider" ref={scrollAnchorRef} className="flex max-w-[860px] flex-col gap-7">
      <EnvOnlineSttConfigCard
        banner={
          <EnvLlmStatusBanner
            connected
            presentation={{
              mode: "cloud",
              tone: panel.presentation.tone,
              bannerTitle: panel.presentation.bannerTitle,
              bannerDetail: panel.presentation.bannerDetail,
            }}
            disabled={panel.formBusy}
            busy={panel.olProbeBusy}
            refreshLabel="探测连接"
            onRefresh={() => void panel.probeOnlineStt()}
          />
        }
        provider={
          <OnlineSttProviderPicker
            busy={panel.formBusy}
            providerId={panel.olProviderId}
            onProviderChange={panel.onProviderChange}
          />
        }
        form={
          <OnlineSttRuntimeForm
            busy={panel.formBusy}
            providerId={panel.olProviderId}
            providerDef={panel.olDef}
            endpoint={panel.olEndpoint}
            timeoutSec={panel.olTimeoutSec}
            appKey={panel.olAppKey}
            apiKey={panel.olApiKey}
            savedApiKeyId={panel.savedApiKeyId}
            keychainReady={panel.keychainChecking ? null : panel.keychainReady}
            onEndpointChange={panel.setOlEndpoint}
            onTimeoutSecChange={panel.setOlTimeoutSec}
            onAppKeyChange={panel.setOlAppKey}
            onApiKeyChange={panel.setOlApiKey}
          />
        }
        footer={
          <>
            <button
              type="button"
              className={`${CONTROL_BTN_SECONDARY} mr-auto text-notion-text-muted`}
              disabled={panel.formBusy || !panel.savedApiKeyId}
              onClick={() => void panel.clearSavedApiKey()}
            >
              清除已保存密钥
            </button>
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={panel.formBusy} onClick={() => void panel.saveOnlineStt()}>
              保存在线配置
            </button>
          </>
        }
      />

      <div className="flex items-start gap-3 border-t border-notion-divider/60 pt-5">
        <Info className={`${LUCIDE_ICON_SIZE_SM} mt-0.5 shrink-0 text-notion-text-muted`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        <div className={`space-y-2 ${PANEL_TYPOGRAPHY.body}`}>
          <p className="m-0">
            内置厂商端点已预置；仅「自定义代理」需填 HTTPS URL。
          </p>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            {sttKeychainReferenceMessage(
              normalizeSttApiKeyId(panel.savedApiKeyId) ?? null,
              panel.keychainChecking ? null : panel.keychainReady,
            )}
          </p>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            本机 FunASR 通过 hotwords 携带术语偏置。
            {panel.onlineGlossarySummary ? ` ${panel.onlineGlossarySummary}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

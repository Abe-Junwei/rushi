import { useState } from "react";
import { ENV_VENDOR_CHIP_BASE, envVendorChipClass } from "../config/envVendorChipStyles";
import { getLlmProviderDefinition, type LlmProviderId } from "../services/postprocess/postprocessRuntimeContract";
import { cloudLlmProviderIds } from "./EnvLlmModeSwitch";

const FEATURED_CLOUD_PROVIDER_IDS: LlmProviderId[] = ["deepseek", "kimi", "qwen"];

const FEATURED_DISPLAY: Partial<Record<LlmProviderId, string>> = {
  deepseek: "DeepSeek",
  kimi: "Kimi",
  qwen: "Qwen",
};

type Props = {
  providerId: LlmProviderId;
  disabled?: boolean;
  onProviderChange: (id: LlmProviderId) => void;
};

function providerChipLabel(id: LlmProviderId): string {
  if (FEATURED_DISPLAY[id]) return FEATURED_DISPLAY[id]!;
  const label = getLlmProviderDefinition(id)?.label ?? id;
  return label.split("（")[0]?.split("(")[0]?.trim() ?? label;
}

const chipBtnBase = `${ENV_VENDOR_CHIP_BASE} bg-transparent`;

/** 云端厂商 chip（卡片上方；Stitch F4/F5）。 */
export function EnvLlmCloudVendorPills({ providerId, disabled, onProviderChange }: Props) {
  const moreIds = cloudLlmProviderIds().filter((id) => !FEATURED_CLOUD_PROVIDER_IDS.includes(id));
  const [moreOpen, setMoreOpen] = useState(() => moreIds.includes(providerId));

  const renderChip = (id: LlmProviderId) => (
    <button
      key={id}
      type="button"
      className={`${chipBtnBase} ${envVendorChipClass(providerId === id)}`}
      disabled={disabled}
      aria-pressed={providerId === id}
      onClick={() => onProviderChange(id)}
    >
      {providerChipLabel(id)}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex flex-wrap gap-2" role="group" aria-label="云端厂商">
        {FEATURED_CLOUD_PROVIDER_IDS.map(renderChip)}
        {moreIds.length > 0 ? (
          <button
            type="button"
            className={`${chipBtnBase} ${envVendorChipClass(false)}`}
            disabled={disabled}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            更多…
          </button>
        ) : null}
      </div>
      {moreOpen && moreIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">{moreIds.map(renderChip)}</div>
      ) : null}
    </div>
  );
}

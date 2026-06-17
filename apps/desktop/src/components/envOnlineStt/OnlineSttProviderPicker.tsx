import { ENV_EXTERNAL_LINK_CLASS, ENV_VENDOR_CHIP_BASE, envVendorChipClass } from "../../config/envVendorChipStyles";
import {
  getSttOnlineProviderDefinition,
  providerSupportsGlossaryBias,
  sttOnlineProviderPickerOptions,
  type SttOnlineProviderDefinition,
} from "../../services/stt/sttOnlineProviderContract";

type Props = {
  busy: boolean;
  providerId: string;
  onProviderChange: (providerId: string) => void;
};

function providerChipLabel(def: SttOnlineProviderDefinition): string {
  const short = def.label.split("（")[0]?.split("(")[0]?.trim();
  return short && short.length > 0 ? short : def.label;
}

const chipBtnBase = `${ENV_VENDOR_CHIP_BASE} bg-transparent`;

export function OnlineSttProviderPicker({ busy, providerId, onProviderChange }: Props) {
  const providerDef = getSttOnlineProviderDefinition(providerId);
  const providers = sttOnlineProviderPickerOptions();

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="radiogroup"
        aria-label="在线 STT 厂商"
      >
        {providers.map((definition) => {
          const selected = definition.id === providerId;
          return (
            <button
              key={definition.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              title={definition.label}
              onClick={() => onProviderChange(definition.id)}
              className={`${chipBtnBase} ${envVendorChipClass(selected)}`}
            >
              {providerChipLabel(definition)}
            </button>
          );
        })}
      </div>

      {providerDef ? (
        <div className="flex flex-col gap-2">
          <p className="text-body leading-relaxed text-notion-text-muted">{providerDef.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {providerDef.experimental ? (
              <span className="rounded-full bg-zen-saffron/15 px-2 py-0.5 text-label font-medium text-notion-text">
                实验
              </span>
            ) : null}
            {providerDef.freeTierNote ? (
              <span
                className="rounded-full bg-notion-sidebar px-2 py-0.5 text-label font-medium text-notion-text-muted"
                title={providerDef.freeTierNote}
              >
                试用 / 免费额
              </span>
            ) : null}
            {providerSupportsGlossaryBias(providerDef.id) ? (
              <span
                className="rounded-full bg-zen-saffron/15 px-2 py-0.5 text-label font-medium text-notion-text"
                title="转写时映射全局术语表"
              >
                术语偏置
              </span>
            ) : null}
          </div>
          {providerDef.docsUrl && providerDef.docsUrl.startsWith("http") && !providerDef.docsUrl.includes("example.com") ? (
            <p className="text-label text-notion-text-muted">
              文档:{" "}
              <a href={providerDef.docsUrl} target="_blank" rel="noreferrer" className={ENV_EXTERNAL_LINK_CLASS}>
                {providerDef.docsUrl.replace(/^https?:\/\//, "").split("/")[0]}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

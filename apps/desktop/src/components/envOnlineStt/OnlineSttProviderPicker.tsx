import {
  getSttOnlineProviderDefinition,
  providerSupportsGlossaryBias,
  sttOnlineProvidersByMarket,
  type SttOnlineMarket,
} from "../../services/stt/sttOnlineProviderContract";
import "../onlineSttProviderList.css";

const STT_MARKET_GROUPS: { market: SttOnlineMarket; label: string }[] = [
  { market: "china", label: "国内（中国区 / 合规云厂商）" },
  { market: "global", label: "国际" },
];

type Props = {
  busy: boolean;
  providerId: string;
  onProviderChange: (providerId: string) => void;
};

export function OnlineSttProviderPicker({ busy, providerId, onProviderChange }: Props) {
  const providerDef = getSttOnlineProviderDefinition(providerId);

  return (
    <>
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-zen-ink">厂商（影响鉴权头与配置项）</p>
        <div className="stt-provider-list" role="radiogroup" aria-label="选择在线 STT 厂商">
          {STT_MARKET_GROUPS.map(({ market, label: groupLabel }) => (
            <div key={market} className="stt-provider-group">
              <p className="stt-provider-group-title">{groupLabel}</p>
              <ul>
                {sttOnlineProvidersByMarket(market).map((definition) => {
                  const selected = definition.id === providerId;
                  const marketShort = market === "china" ? "国内" : "国际";
                  return (
                    <li key={definition.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={busy}
                        onClick={() => onProviderChange(definition.id)}
                        className={`stt-provider-card${selected ? " stt-provider-card--selected" : ""}`}
                      >
                        <div className="stt-provider-card__head">
                          <span className="stt-provider-card__title">{definition.label}</span>
                          <span className="stt-provider-card__market">{marketShort}</span>
                        </div>
                        <p className="stt-provider-card__desc">{definition.description}</p>
                        <div className="stt-provider-card__meta">
                          {definition.experimental ? (
                            <span className="stt-provider-chip stt-provider-chip--accent">实验</span>
                          ) : null}
                          {definition.freeTierNote ? (
                            <span className="stt-provider-chip" title={definition.freeTierNote}>
                              试用 / 免费额
                            </span>
                          ) : null}
                          {providerSupportsGlossaryBias(definition.id) ? (
                            <span className="stt-provider-chip stt-provider-chip--accent" title="转写时映射全局术语表">
                              术语偏置
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {providerDef?.docsUrl && providerDef.docsUrl.startsWith("http") && !providerDef.docsUrl.includes("example.com") ? (
        <p className="text-[11px] text-zen-stone">
          文档:{" "}
          <a
            href={providerDef.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-zen-indigo underline decoration-zen-indigo/30 hover:text-zen-ink"
          >
            {providerDef.docsUrl.replace(/^https?:\/\//, "").split("/")[0]}
          </a>
        </p>
      ) : null}
    </>
  );
}

import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  LLM_CAPABILITIES,
  llmAutoPunctuateCapabilityBadge,
  type LlmConnectionUiStatus,
} from "../services/postprocess/postprocessRuntimeContract";

type Props = {
  connectionStatus: LlmConnectionUiStatus;
};

export function EnvLlmCapabilitiesSection({ connectionStatus }: Props) {
  const badge = llmAutoPunctuateCapabilityBadge(connectionStatus);
  const badgeClass =
    connectionStatus === "verified"
      ? "rounded bg-zen-saffron/15 px-1.5 py-0.5 text-[10px] font-semibold text-zen-saffron"
      : connectionStatus === "unverified"
        ? "rounded bg-zen-saffron/10 px-1.5 py-0.5 text-[10px] font-semibold text-notion-text-muted"
        : "rounded bg-notion-sidebar px-1.5 py-0.5 text-[10px] font-semibold text-notion-text-muted";

  return (
    <section className="space-y-2 rounded-lg bg-notion-sidebar/60 px-3 py-3">
      <h4 className={PANEL_TYPOGRAPHY.sectionTitle}>已接入能力</h4>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {LLM_CAPABILITIES.map((cap) => (
          <li key={cap.id} className="flex flex-col gap-0.5 rounded-md bg-white/80 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-notion-text">{cap.label}</span>
              <span className={badgeClass}>{badge}</span>
            </div>
            <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{cap.description}</p>
          </li>
        ))}
      </ul>
      <p className={`m-0 ${PANEL_TYPOGRAPHY.helper}`}>
        「可用」仅表示连接已通过探测验证；产品能力已接入不代表当前环境已就绪。
      </p>
    </section>
  );
}

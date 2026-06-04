import { PANEL_TYPOGRAPHY } from "../config/typography";
import { LLM_CAPABILITIES } from "../services/postprocess/postprocessRuntimeContract";
import type { LlmEnvPresentation } from "../services/llm/llmEnvStatus";

type Props = {
  presentation: LlmEnvPresentation;
};

export function EnvLlmCapabilitiesSection({ presentation }: Props) {
  return (
    <section className="space-y-2 rounded-lg bg-notion-sidebar/60 px-3 py-3">
      <h4 className={PANEL_TYPOGRAPHY.sectionTitle}>已接入能力</h4>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {LLM_CAPABILITIES.map((cap) => (
          <li key={cap.id} className="flex flex-col gap-0.5 rounded-md bg-white/80 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-notion-text">{cap.label}</span>
              <span className={presentation.capabilityBadgeClass}>{presentation.capabilityBadge}</span>
            </div>
            <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{cap.description}</p>
          </li>
        ))}
      </ul>
      <p className={`m-0 ${PANEL_TYPOGRAPHY.helper}`}>
        {presentation.mode === "local"
          ? "「服务就绪」= Ollama 已响应且模型已 pull；「可用」= 已通过「探测连接」。自动标点需「可用」。"
          : "「可用」= API Key 已保存且「探测连接」成功。自动标点需「可用」。"}
      </p>
    </section>
  );
}

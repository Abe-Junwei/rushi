import { PANEL_TYPOGRAPHY } from "../config/typography";
import { LLM_CAPABILITIES } from "../services/postprocess/postprocessRuntimeContract";
import type { LlmEnvPresentation } from "../services/llm/llmEnvStatus";

type Props = {
  presentation: LlmEnvPresentation;
};

export function EnvLlmCapabilitiesSection({ presentation }: Props) {
  return (
    <section className="border-t border-notion-divider/60 pt-5">
      <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>导出能力</h3>
      <p className={`mt-1 mb-3 ${PANEL_TYPOGRAPHY.meta}`}>
        配置保存并探测通过后，以下 LLM 能力可用于导出润色等环节。
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {LLM_CAPABILITIES.map((cap) => (
          <li key={cap.id} className="flex items-center justify-between gap-3">
            <span className={`${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>{cap.label}</span>
            <span className={presentation.capabilityBadgeClass}>{presentation.capabilityBadge}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

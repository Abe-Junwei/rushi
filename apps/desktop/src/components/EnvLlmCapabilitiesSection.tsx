import { PANEL_TYPOGRAPHY } from "../config/typography";
import { LLM_CAPABILITIES } from "../services/postprocess/postprocessRuntimeContract";

export function EnvLlmCapabilitiesSection() {
  return (
    <section className="space-y-2 rounded-lg bg-notion-sidebar/60 px-3 py-3">
      <h4 className={PANEL_TYPOGRAPHY.sectionTitle}>已接入能力</h4>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {LLM_CAPABILITIES.map((cap) => (
          <li key={cap.id} className="flex flex-col gap-0.5 rounded-md bg-white/80 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-notion-text">{cap.label}</span>
              <span className="rounded bg-zen-saffron/15 px-1.5 py-0.5 text-[10px] font-semibold text-zen-saffron">
                可用
              </span>
            </div>
            <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{cap.description}</p>
          </li>
        ))}
      </ul>
      <p className={`m-0 ${PANEL_TYPOGRAPHY.helper}`}>
        更多 LLM 能力将在此列出；连接与密钥保持一处配置，避免重复填写。
      </p>
    </section>
  );
}

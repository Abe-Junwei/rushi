import type { ReactNode } from "react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { ENV_PANEL_SECTION_CLASS } from "../utils/environmentPanelNav";

type EnvPrefGroupShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** 偏好页一级分组：扁平 section（与环境页 LLM / 快捷键等一致）。 */
export function EnvPrefGroupShell({ title, description, children }: EnvPrefGroupShellProps) {
  return (
    <section className={ENV_PANEL_SECTION_CLASS}>
      <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>{title}</h3>
      {description ? <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{description}</p> : null}
      {children}
    </section>
  );
}

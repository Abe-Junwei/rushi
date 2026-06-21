import type { ReactNode } from "react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { ENV_PANEL_REGION_CLASS } from "../utils/environmentPanelNav";

type EnvPrefGroupShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** 偏好页一级分组：标题 + sidebar 底内容区。 */
export function EnvPrefGroupShell({ title, description, children }: EnvPrefGroupShellProps) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>{title}</h3>
        {description ? <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{description}</p> : null}
      </header>
      <div className={ENV_PANEL_REGION_CLASS}>{children}</div>
    </section>
  );
}

type EnvPrefSubgroupProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

/** 偏好页二级子分组（uppercase 标签，与 LLM / STT 表单一致）。 */
export function EnvPrefSubgroup({ label, children, className }: EnvPrefSubgroupProps) {
  return (
    <div className={["flex flex-col gap-3", className].filter(Boolean).join(" ")}>
      <h4 className={PANEL_TYPOGRAPHY.envFieldLabel}>{label}</h4>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GLOSSARY_INSPECTOR_HEADER, GLOSSARY_INSPECTOR_SHELL } from "./glossaryPanelStyles";

type Props = {
  title: string;
  onClose?: () => void;
  children?: ReactNode;
};

export function GlossaryInspectorPanel({ title, onClose, children }: Props) {
  return (
    <aside className={GLOSSARY_INSPECTOR_SHELL}>
      <div className={GLOSSARY_INSPECTOR_HEADER}>
        <h3 className={`m-0 ${PANEL_TYPOGRAPHY.sectionTitle} text-sm font-semibold text-notion-text`}>
          {title}
        </h3>
        {onClose ? (
          <button
            type="button"
            className="rounded-sm border-0 bg-transparent p-1 text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
            aria-label="关闭检视器"
            onClick={onClose}
          >
            <X className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{children}</div>
    </aside>
  );
}

import type { ReactNode } from "react";
import {
  IconX as X,
} from "@tabler/icons-react";
import { CONTROL_BTN_ICON_GHOST } from "../../config/controlStyles";
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
            className={CONTROL_BTN_ICON_GHOST}
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

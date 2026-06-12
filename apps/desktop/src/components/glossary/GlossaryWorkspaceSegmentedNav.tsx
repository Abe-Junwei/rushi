import {
  ENV_LLM_MODE_TOGGLE_TRACK,
  ENV_SEGMENTED_ROW,
  envLlmModeToggleBtnClass,
} from "../../config/controlStyles";
import { GLOSSARY_WORKSPACE_NAV_ITEMS } from "./glossaryWorkspaceNav";
import type { GlossaryWorkspaceId } from "./glossaryWorkspaceTypes";

type Props = {
  value: GlossaryWorkspaceId;
  disabled?: boolean;
  onChange: (id: GlossaryWorkspaceId) => void;
};

export function GlossaryWorkspaceSegmentedNav({ value, disabled, onChange }: Props) {
  return (
    <div
      className="shrink-0 border-b border-notion-divider bg-notion-bg px-4 py-2"
      data-purpose="glossary-workspace-segmented"
    >
      <div className={ENV_SEGMENTED_ROW}>
        <div className={ENV_LLM_MODE_TOGGLE_TRACK} role="radiogroup" aria-label="热词与记忆工作区">
          {GLOSSARY_WORKSPACE_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              className={envLlmModeToggleBtnClass(value === item.id)}
              aria-checked={value === item.id}
              disabled={disabled}
              onClick={() => onChange(item.id)}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                {item.icon}
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

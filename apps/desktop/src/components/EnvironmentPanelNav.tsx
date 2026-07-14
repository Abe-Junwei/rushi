import type { TablerIcon } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { PRODUCT_ICON } from "../config/productIcons";
import { ENV_STATUS_DOT_CLASS, type EnvStatusTone } from "./topBarStatusTone";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import {
  ENV_NAV_BTN_BASE,
  ENV_NAV_ITEM_DEFS,
  type EnvNavId,
  type EnvNavItemDef,
} from "../utils/environmentPanelNav";

function envNavStatusDotClass(tone: EnvStatusTone): string {
  return ENV_STATUS_DOT_CLASS[tone];
}

function EnvNavIcon({ icon: Icon }: { icon: TablerIcon }) {
  return <Icon className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />;
}

const ENV_NAV_ICONS: Record<EnvNavId, ReactNode> = {
  "local-asr": <EnvNavIcon icon={PRODUCT_ICON.navLocalAsr} />,
  "online-stt": <EnvNavIcon icon={PRODUCT_ICON.navOnlineStt} />,
  llm: <EnvNavIcon icon={PRODUCT_ICON.navLlm} />,
  preferences: <EnvNavIcon icon={PRODUCT_ICON.navPreferences} />,
  shortcuts: <EnvNavIcon icon={PRODUCT_ICON.navShortcuts} />,
  profile: <EnvNavIcon icon={PRODUCT_ICON.navProfileMigrate} />,
  quality: <EnvNavIcon icon={PRODUCT_ICON.navQuality} />,
  about: <EnvNavIcon icon={PRODUCT_ICON.navAbout} />,
};

export type EnvironmentPanelNavProps = {
  envSection: EnvNavId;
  layoutCompact: boolean;
  asrNavTone: EnvStatusTone | null;
  onlineSttNavTone: EnvStatusTone | null;
  llmNavTone: EnvStatusTone | null;
  onSelectSection: (id: EnvNavId) => void;
};

function statusToneForItem(
  item: EnvNavItemDef,
  asrNavTone: EnvStatusTone | null,
  onlineSttNavTone: EnvStatusTone | null,
  llmNavTone: EnvStatusTone | null,
): EnvStatusTone | null {
  if (item.id === "local-asr") return asrNavTone;
  if (item.id === "online-stt") return onlineSttNavTone;
  if (item.id === "llm") return llmNavTone;
  return null;
}

export function EnvironmentPanelNav({
  envSection,
  layoutCompact,
  asrNavTone,
  onlineSttNavTone,
  llmNavTone,
  onSelectSection,
}: EnvironmentPanelNavProps) {
  const navWidthClass = layoutCompact ? "w-48" : "w-60";

  return (
    <nav className={`flex h-full ${navWidthClass} shrink-0 flex-col overflow-y-auto border-r border-notion-divider bg-notion-sidebar py-5`}>
      <div className="flex flex-1 flex-col">
        {ENV_NAV_ITEM_DEFS.map((item) => {
          const active = envSection === item.id;
          const statusTone = statusToneForItem(item, asrNavTone, onlineSttNavTone, llmNavTone);
          return (
            <button
              key={item.id}
              type="button"
              className={`${ENV_NAV_BTN_BASE} ${item.pinBottom ? "mt-auto" : ""} ${
                active
                  ? "border-l-4 border-accent-action bg-notion-sidebar-active text-notion-text"
                  : "border-l-4 border-transparent bg-transparent text-notion-text-muted hover:bg-notion-sidebar-hover"
              }`}
              aria-current={active ? "true" : undefined}
              onClick={() => onSelectSection(item.id)}
            >
              <span className={`mr-3 shrink-0 ${active ? "text-notion-text" : "text-notion-text-muted"}`}>
                {ENV_NAV_ICONS[item.id]}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-title leading-snug ${active ? "font-bold text-notion-text" : "font-medium text-notion-text"}`}>
                  {item.label}
                </span>
                <span className="mt-0.5 block text-label leading-snug text-notion-text-muted">{item.description}</span>
              </span>
              {statusTone ? (
                <span
                  className={`ml-2 mt-1 h-2 w-2 shrink-0 rounded-full ${envNavStatusDotClass(statusTone)}`}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

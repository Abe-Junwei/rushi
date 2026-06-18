import { BarChart3, Cloud, Cpu, Download, HelpCircle, Info, Keyboard, Palette, Sparkles } from "lucide-react";
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

const ENV_NAV_ICONS: Record<EnvNavId, React.ReactNode> = {
  "local-asr": <Cpu className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  "online-stt": <Cloud className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  llm: <Sparkles className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  appearance: <Palette className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  shortcuts: <Keyboard className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  profile: <Download className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  quality: <BarChart3 className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  help: <HelpCircle className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  about: <Info className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
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
                <span className="mt-0.5 block truncate text-label leading-tight text-notion-text-muted">
                  {item.description}
                </span>
              </span>
              {statusTone ? (
                <span
                  className={`ml-2 h-1.5 w-1.5 shrink-0 rounded-full ${envNavStatusDotClass(statusTone)}`}
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

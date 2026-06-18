import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { OFFICE_ACCENT_THEME_PRESETS } from "../config/officeAccentThemes";
import { OFFICE_SHELL_THEME_PRESETS } from "../config/officeShellThemes";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { ENV_PANEL_PAGE_CLASS, ENV_PANEL_SECTION_CLASS } from "../utils/environmentPanelNav";
import {
  applyOfficeAccentTheme,
  getOfficeAccentThemeSnapshot,
  subscribeOfficeAccentTheme,
} from "../services/ui/officeAccentTheme";
import {
  applyOfficeShellTheme,
  getOfficeShellThemeSnapshot,
  subscribeOfficeShellTheme,
} from "../services/ui/officeShellTheme";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

export function EnvAppearancePanel() {
  const activeShellId = useSyncExternalStore(
    subscribeOfficeShellTheme,
    getOfficeShellThemeSnapshot,
    getOfficeShellThemeSnapshot,
  );
  const activeAccentId = useSyncExternalStore(
    subscribeOfficeAccentTheme,
    getOfficeAccentThemeSnapshot,
    getOfficeAccentThemeSnapshot,
  );

  return (
    <div className={ENV_PANEL_PAGE_CLASS} data-purpose="env-appearance-page">
      <section className={ENV_PANEL_SECTION_CLASS} aria-label="界面主题">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>界面主题</h3>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5">
          {OFFICE_SHELL_THEME_PRESETS.map((preset) => {
            const selected = activeShellId === preset.id;
            return (
              <li key={preset.id} className="list-none">
                <button
                  type="button"
                  className={[
                    "flex w-full flex-col items-center gap-2 rounded-md border bg-notion-bg px-2 py-3 text-center shadow-none transition-colors",
                    selected
                      ? "border-accent-action ring-2 ring-accent-action/25"
                      : "border-notion-border hover:border-notion-text-light hover:bg-notion-sidebar-hover",
                  ].join(" ")}
                  aria-pressed={selected}
                  aria-label={`界面主题：${preset.label}`}
                  onClick={() => applyOfficeShellTheme(preset.id)}
                >
                  <span
                    className={`shell-theme-preview shell-theme-preview--${preset.id} relative overflow-hidden rounded-sm border border-notion-border/80`}
                    aria-hidden
                  >
                    <span className="shell-theme-preview__top" />
                    <span className="shell-theme-preview__body" />
                    {selected ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-zen-ink/10">
                        <Check
                          className={`${LUCIDE_ICON_SIZE_SM} text-notion-text`}
                          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                        />
                      </span>
                    ) : null}
                  </span>
                  <span className="text-label font-medium leading-snug text-notion-text">{preset.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={ENV_PANEL_SECTION_CLASS} aria-label="主题色">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>主题色</h3>
        <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4">
          {OFFICE_ACCENT_THEME_PRESETS.map((preset) => {
            const selected = activeAccentId === preset.id;
            return (
              <li key={preset.id} className="list-none">
                <button
                  type="button"
                  className={[
                    "flex w-full flex-col items-center gap-2 rounded-md border bg-notion-bg px-2 py-3 text-center shadow-none transition-colors",
                    selected
                      ? "border-accent-action ring-2 ring-accent-action/25"
                      : "border-notion-border hover:border-notion-text-light hover:bg-notion-sidebar-hover",
                  ].join(" ")}
                  aria-pressed={selected}
                  aria-label={`主题色：${preset.label}`}
                  onClick={() => applyOfficeAccentTheme(preset.id)}
                >
                  <span
                    className={`accent-theme-swatch--${preset.id} relative flex h-10 w-10 items-center justify-center rounded-full border border-notion-border/80`}
                    aria-hidden
                  >
                    {selected ? (
                      <Check
                        className={`${LUCIDE_ICON_SIZE_SM} text-white drop-shadow-sm`}
                        strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                      />
                    ) : null}
                  </span>
                  <span className="text-label font-medium leading-snug text-notion-text">{preset.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

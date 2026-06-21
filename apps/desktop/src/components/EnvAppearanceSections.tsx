import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { OFFICE_ACCENT_THEME_PRESETS } from "../config/officeAccentThemes";
import { OFFICE_SHELL_THEME_PRESETS } from "../config/officeShellThemes";
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
import { EnvPrefSubgroup } from "./EnvPrefGroupShell";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

function envThemeTileClass(selected: boolean): string {
  return [
    "flex w-full flex-col items-center gap-2 rounded-md px-2 py-3 text-center shadow-none transition-colors",
    selected
      ? "bg-notion-bg ring-2 ring-accent-action/25"
      : "bg-transparent hover:bg-notion-bg/80",
  ].join(" ");
}

export function EnvAppearanceSections() {
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
    <div className="flex flex-col gap-6">
      <EnvPrefSubgroup label="界面主题">
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {OFFICE_SHELL_THEME_PRESETS.map((preset) => {
            const selected = activeShellId === preset.id;
            return (
              <li key={preset.id} className="list-none">
                <button
                  type="button"
                  className={envThemeTileClass(selected)}
                  aria-pressed={selected}
                  aria-label={`界面主题：${preset.label}`}
                  onClick={() => applyOfficeShellTheme(preset.id)}
                >
                  <span
                    className={`shell-theme-preview shell-theme-preview--${preset.id} relative overflow-hidden rounded-sm`}
                    aria-hidden
                  >
                    <span className="shell-theme-preview__top" />
                    <span className="shell-theme-preview__body" />
                    {selected ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-zen-ink/10">
                        <Check
                          className={`${LUCIDE_ICON_SIZE_SM} text-notion-text`}
                          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                          aria-hidden
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
      </EnvPrefSubgroup>

      <EnvPrefSubgroup label="主题色">
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4 sm:gap-3">
          {OFFICE_ACCENT_THEME_PRESETS.map((preset) => {
            const selected = activeAccentId === preset.id;
            return (
              <li key={preset.id} className="list-none">
                <button
                  type="button"
                  className={envThemeTileClass(selected)}
                  aria-pressed={selected}
                  aria-label={`主题色：${preset.label}`}
                  onClick={() => applyOfficeAccentTheme(preset.id)}
                >
                  <span
                    className={`accent-theme-swatch--${preset.id} relative flex h-10 w-10 items-center justify-center rounded-full`}
                    aria-hidden
                  >
                    {selected ? (
                      <Check
                        className={`${LUCIDE_ICON_SIZE_SM} text-white drop-shadow-sm`}
                        strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span className="text-label font-medium leading-snug text-notion-text">{preset.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </EnvPrefSubgroup>
    </div>
  );
}

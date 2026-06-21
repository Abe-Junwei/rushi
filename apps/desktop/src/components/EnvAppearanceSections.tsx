import { useSyncExternalStore } from "react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  isOfficeAccentThemeId,
  OFFICE_ACCENT_THEME_PRESETS,
  type OfficeAccentThemeId,
} from "../config/officeAccentThemes";
import {
  isOfficeShellThemeId,
  OFFICE_SHELL_THEME_PRESETS,
  type OfficeShellThemeId,
} from "../config/officeShellThemes";
import { ENV_PANEL_FORM_FIELD_CLASS } from "../utils/environmentPanelNav";
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
import { EnvPanelSelect, type EnvPanelSelectOption } from "./EnvPanelSelect";

function ShellThemePreview({ id }: { id: OfficeShellThemeId }) {
  return (
    <span
      className={`shell-theme-preview shell-theme-preview--${id} !h-5 !w-8 shrink-0 rounded-sm`}
      aria-hidden
    >
      <span className="shell-theme-preview__top" />
      <span className="shell-theme-preview__body" />
    </span>
  );
}

function AccentThemePreview({ id }: { id: OfficeAccentThemeId }) {
  return <span className={`accent-theme-swatch--${id} h-5 w-5 shrink-0 rounded-full`} aria-hidden />;
}

const SHELL_OPTIONS: EnvPanelSelectOption<OfficeShellThemeId>[] = OFFICE_SHELL_THEME_PRESETS.map(
  (preset) => ({
    id: preset.id,
    label: preset.label,
  }),
);

const ACCENT_OPTIONS: EnvPanelSelectOption<OfficeAccentThemeId>[] = OFFICE_ACCENT_THEME_PRESETS.map(
  (preset) => ({
    id: preset.id,
    label: preset.label,
  }),
);

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
    <div className="grid gap-5 sm:grid-cols-2">
      <div className={ENV_PANEL_FORM_FIELD_CLASS}>
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>界面主题</span>
        <EnvPanelSelect
          id="pref-shell-theme"
          aria-label="界面主题"
          value={activeShellId}
          options={SHELL_OPTIONS}
          onChange={(next) => {
            if (isOfficeShellThemeId(next)) applyOfficeShellTheme(next);
          }}
          renderPreview={(option) => <ShellThemePreview id={option.id} />}
        />
      </div>

      <div className={ENV_PANEL_FORM_FIELD_CLASS}>
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>主题色</span>
        <EnvPanelSelect
          id="pref-accent-theme"
          aria-label="主题色"
          value={activeAccentId}
          options={ACCENT_OPTIONS}
          onChange={(next) => {
            if (isOfficeAccentThemeId(next)) applyOfficeAccentTheme(next);
          }}
          renderPreview={(option) => <AccentThemePreview id={option.id} />}
        />
      </div>
    </div>
  );
}

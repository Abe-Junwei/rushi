import { useMemo, useSyncExternalStore } from "react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { CONTROL_BTN_GHOST } from "../config/controlStyles";
import {
  isOfficeShellThemeId,
  OFFICE_SHELL_THEME_PRESETS,
  type OfficeShellThemeId,
} from "../config/officeShellThemes";
import { ENV_PANEL_FORM_FIELD_CLASS } from "../utils/environmentPanelNav";
import {
  applyOfficeAccentColor,
  getOfficeAccentColorSnapshot,
  resetOfficeAccentColor,
  subscribeOfficeAccentTheme,
} from "../services/ui/officeAccentTheme";
import {
  applyOfficeShellTheme,
  getOfficeShellThemeSnapshot,
  subscribeOfficeShellTheme,
} from "../services/ui/officeShellTheme";
import {
  applyUiDisplayScale,
  formatUiDisplayScaleLabel,
  getUiDisplayScaleSnapshot,
  snapUiDisplayScale,
  subscribeUiDisplayScale,
  UI_DISPLAY_SCALE_PRESETS,
} from "../services/ui/uiDisplayScale";
import { isBrandAccentHex } from "../utils/deriveAccentRamp";
import { EnvPanelSelect, type EnvPanelSelectOption } from "./EnvPanelSelect";
import { CspLayout } from "./CspLayout";

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

const SHELL_OPTIONS: EnvPanelSelectOption<OfficeShellThemeId>[] = OFFICE_SHELL_THEME_PRESETS.map(
  (preset) => ({
    id: preset.id,
    label: preset.label,
  }),
);

const UI_SCALE_OPTIONS: EnvPanelSelectOption[] = UI_DISPLAY_SCALE_PRESETS.map((scale) => ({
  id: String(scale),
  label: formatUiDisplayScaleLabel(scale),
}));

export function EnvAppearanceSections() {
  const activeShellId = useSyncExternalStore(
    subscribeOfficeShellTheme,
    getOfficeShellThemeSnapshot,
    getOfficeShellThemeSnapshot,
  );
  const activeAccentHex = useSyncExternalStore(
    subscribeOfficeAccentTheme,
    getOfficeAccentColorSnapshot,
    getOfficeAccentColorSnapshot,
  );
  const activeUiScale = useSyncExternalStore(
    subscribeUiDisplayScale,
    getUiDisplayScaleSnapshot,
    getUiDisplayScaleSnapshot,
  );
  const uiScaleSelectValue = useMemo(() => String(activeUiScale), [activeUiScale]);
  const isBrand = isBrandAccentHex(activeAccentHex);

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
        <div className="flex items-center gap-2">
          <label className="relative inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center">
            <CspLayout
              as="span"
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full border border-notion-border shadow-none"
              layout={{ backgroundColor: activeAccentHex }}
            />
            <input
              id="pref-accent-color"
              type="color"
              aria-label="主题色"
              value={activeAccentHex}
              onChange={(event) => applyOfficeAccentColor(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <button
            type="button"
            className={CONTROL_BTN_GHOST}
            aria-label="重置主题色"
            disabled={isBrand}
            onClick={() => resetOfficeAccentColor()}
          >
            重置
          </button>
        </div>
      </div>

      <div className={`${ENV_PANEL_FORM_FIELD_CLASS} sm:col-span-2`}>
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>界面缩放</span>
        <div className="max-w-[12rem]">
          <EnvPanelSelect
            id="pref-ui-scale"
            aria-label="界面缩放"
            value={uiScaleSelectValue}
            options={UI_SCALE_OPTIONS}
            onChange={(next) => applyUiDisplayScale(snapUiDisplayScale(Number(next)))}
          />
        </div>
        <span className={PANEL_TYPOGRAPHY.meta}>
          当前为最小基准；放大后字号、按钮与间距一并适配（与下方「语段正文字号」无关）。
        </span>
      </div>
    </div>
  );
}

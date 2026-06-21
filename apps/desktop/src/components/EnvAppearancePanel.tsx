import { EnvAppearanceSections } from "./EnvAppearanceSections";
import { EnvPrefGroupShell } from "./EnvPrefGroupShell";
import { ENV_PANEL_PAGE_CLASS } from "../utils/environmentPanelNav";

/** @deprecated 使用 {@link EnvPreferencesPanel} */
export function EnvAppearancePanel() {
  return (
    <div className={ENV_PANEL_PAGE_CLASS} data-purpose="env-appearance-page">
      <EnvPrefGroupShell title="外观" description="界面主题与强调色；变更后立即生效。">
        <EnvAppearanceSections />
      </EnvPrefGroupShell>
    </div>
  );
}

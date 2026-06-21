import { EnvAppearanceSections } from "./EnvAppearanceSections";

/** @deprecated 使用 {@link EnvPreferencesPanel} */
export function EnvAppearancePanel() {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8" data-purpose="env-appearance-page">
      <EnvAppearanceSections />
    </div>
  );
}

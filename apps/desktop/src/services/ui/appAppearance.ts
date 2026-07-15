import { subscribeOfficeAccentTheme } from "./officeAccentTheme";
import { subscribeOfficeShellTheme } from "./officeShellTheme";
import { subscribeUiDisplayScale } from "./uiDisplayScale";

/** 壳层主题 + 主题色 + 界面缩放变更（波形 peaks / canvas 重绘、WaveSurfer setOptions）。 */
export function subscribeAppAppearance(listener: () => void): () => void {
  const unsubShell = subscribeOfficeShellTheme(listener);
  const unsubAccent = subscribeOfficeAccentTheme(listener);
  const unsubScale = subscribeUiDisplayScale(listener);
  return () => {
    unsubShell();
    unsubAccent();
    unsubScale();
  };
}

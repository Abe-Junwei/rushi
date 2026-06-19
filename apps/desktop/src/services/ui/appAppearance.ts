import { subscribeOfficeAccentTheme } from "./officeAccentTheme";
import { subscribeOfficeShellTheme } from "./officeShellTheme";

/** 壳层主题 + 主题色变更（波形 peaks / canvas 重绘、WaveSurfer setOptions）。 */
export function subscribeAppAppearance(listener: () => void): () => void {
  const unsubShell = subscribeOfficeShellTheme(listener);
  const unsubAccent = subscribeOfficeAccentTheme(listener);
  return () => {
    unsubShell();
    unsubAccent();
  };
}

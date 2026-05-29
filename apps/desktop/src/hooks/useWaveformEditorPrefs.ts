import { useCallback, useEffect, useState } from "react";
import {
  readStoredWaveformGlobalStripCollapsed,
  writeStoredWaveformGlobalStripCollapsed,
} from "../utils/waveformPrefs";

export function useWaveformEditorPrefs(_mediaUrl: string | null) {
  const [globalStripCollapsed, setGlobalStripCollapsedState] = useState(readStoredWaveformGlobalStripCollapsed);

  useEffect(() => {
    writeStoredWaveformGlobalStripCollapsed(globalStripCollapsed);
  }, [globalStripCollapsed]);

  const setGlobalStripCollapsed = useCallback((collapsed: boolean) => {
    setGlobalStripCollapsedState(collapsed);
  }, []);

  const toggleGlobalStripCollapsed = useCallback(() => {
    setGlobalStripCollapsedState((c) => !c);
  }, []);

  return {
    globalStripCollapsed,
    setGlobalStripCollapsed,
    toggleGlobalStripCollapsed,
  };
}

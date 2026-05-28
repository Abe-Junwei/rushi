import { useCallback, useEffect, useState } from "react";
import {
  readStoredAutoFitSelectionToViewport,
  readStoredWaveformGlobalStripCollapsed,
  writeStoredAutoFitSelectionToViewport,
  writeStoredWaveformGlobalStripCollapsed,
} from "../utils/waveformPrefs";

export function useWaveformEditorPrefs(_mediaUrl: string | null) {
  const [autoFitSelectionToViewport, setAutoFitSelectionToViewportState] = useState(
    readStoredAutoFitSelectionToViewport,
  );
  const [globalStripCollapsed, setGlobalStripCollapsedState] = useState(readStoredWaveformGlobalStripCollapsed);
  useEffect(() => {
    writeStoredAutoFitSelectionToViewport(autoFitSelectionToViewport);
  }, [autoFitSelectionToViewport]);

  useEffect(() => {
    writeStoredWaveformGlobalStripCollapsed(globalStripCollapsed);
  }, [globalStripCollapsed]);

  const setAutoFitSelectionToViewport = useCallback((enabled: boolean) => {
    setAutoFitSelectionToViewportState(enabled);
  }, []);

  const setGlobalStripCollapsed = useCallback((collapsed: boolean) => {
    setGlobalStripCollapsedState(collapsed);
  }, []);

  const toggleGlobalStripCollapsed = useCallback(() => {
    setGlobalStripCollapsedState((c) => !c);
  }, []);

  return {
    autoFitSelectionToViewport,
    setAutoFitSelectionToViewport,
    globalStripCollapsed,
    setGlobalStripCollapsed,
    toggleGlobalStripCollapsed,
  };
}

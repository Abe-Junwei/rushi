import { useCallback } from "react";
import * as p1 from "../tauri/projectApi";
import type { ProjectDetail } from "../tauri/projectApi";

type Args = {
  busy: boolean;
  current: ProjectDetail | null;
  setError: (msg: string) => void;
  setPickedPath: (path: string | null) => void;
  refreshCurrentProjectBase: () => Promise<void>;
};

export function useProjectLifecycleFileActions({
  busy,
  current,
  setError,
  setPickedPath,
  refreshCurrentProjectBase,
}: Args) {
  const refreshCurrentProject = useCallback(async () => {
    if (busy || !current) return;
    await refreshCurrentProjectBase();
  }, [busy, current, refreshCurrentProjectBase]);

  const pickAudio = useCallback(async () => {
    if (busy) return;
    setError("");
    try {
      const p = await p1.pickAudioPath();
      setPickedPath(p ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [busy, setError, setPickedPath]);

  const clearPickedAudio = useCallback(() => {
    setPickedPath(null);
  }, [setPickedPath]);

  const openAppDataFolder = useCallback(async () => {
    if (busy) return;
    setError("");
    try {
      await p1.openAppDataFolder();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [busy, setError]);

  return {
    refreshCurrentProject,
    pickAudio,
    clearPickedAudio,
    openAppDataFolder,
  };
}

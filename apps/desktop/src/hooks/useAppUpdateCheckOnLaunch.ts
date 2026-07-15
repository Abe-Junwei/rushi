import { useCallback, useEffect, useRef, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { isTauriRuntime } from "../config/env";
import {
  APP_UPDATE_BACKGROUND_CHECK_INTERVAL_MS,
  checkForAppUpdate,
  downloadAndInstallAppUpdate,
  mapAppUpdateError,
  shouldRunBackgroundAppUpdateCheck,
} from "../services/appUpdate";
import { toast } from "../services/ui/toast";
import { fetchAppBuildInfo } from "../tauri/appInfoApi";

export function useAppUpdateCheckOnLaunch() {
  const checkedLaunchRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState<string | undefined>();
  const pendingUpdateRef = useRef<Update | null>(null);
  const openRef = useRef(false);
  const busyRef = useRef(false);
  openRef.current = open;
  busyRef.current = busy;

  const applyAvailableUpdate = useCallback(
    (result: { update: Update; version: string; notes?: string }) => {
      if (
        !shouldRunBackgroundAppUpdateCheck({
          dialogOpen: openRef.current,
          downloadBusy: busyRef.current,
        })
      ) {
        return;
      }
      pendingUpdateRef.current = result.update;
      setVersion(result.version);
      setNotes(result.notes);
      setOpen(true);
    },
    [],
  );

  useEffect(() => {
    if (!isTauriRuntime() || checkedLaunchRef.current) return;
    checkedLaunchRef.current = true;
    let cancelled = false;
    let intervalId: number | undefined;

    const runCheck = async (source: "launch" | "background") => {
      try {
        if (
          source === "background" &&
          !shouldRunBackgroundAppUpdateCheck({
            dialogOpen: openRef.current,
            downloadBusy: busyRef.current,
          })
        ) {
          return;
        }
        const info = await fetchAppBuildInfo();
        if (cancelled) return;
        const result = await checkForAppUpdate(info.version);
        if (cancelled) return;
        if (result.kind === "available") {
          applyAvailableUpdate(result);
        } else if (result.kind === "error") {
          if (source === "launch") {
            toast.error(result.message);
          } else {
            console.warn("[appUpdate] background check failed", result.message);
          }
        }
      } catch (error) {
        if (source === "launch") {
          console.warn("[appUpdate] launch check failed", error);
        } else {
          console.warn("[appUpdate] background check failed", error);
        }
      }
    };

    void (async () => {
      await runCheck("launch");
      if (cancelled) return;
      // VS Code 式：启动已查过后，每小时再问一次清单。
      intervalId = window.setInterval(() => {
        void runCheck("background");
      }, APP_UPDATE_BACKGROUND_CHECK_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, [applyAvailableUpdate]);

  const cancel = useCallback(() => {
    if (busy) return;
    setOpen(false);
    pendingUpdateRef.current = null;
  }, [busy]);

  const confirm = useCallback(async () => {
    const update = pendingUpdateRef.current;
    if (!update || busy) return;
    setBusy(true);
    try {
      await downloadAndInstallAppUpdate(update);
    } catch (error) {
      toast.error(mapAppUpdateError(error));
      setBusy(false);
    }
  }, [busy]);

  return {
    dialogOpen: open,
    dialogBusy: busy,
    dialogVersion: version,
    dialogNotes: notes,
    onDialogCancel: cancel,
    onDialogConfirm: confirm,
  };
}

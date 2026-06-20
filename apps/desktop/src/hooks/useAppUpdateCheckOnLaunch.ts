import { useCallback, useEffect, useRef, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { isTauriRuntime } from "../config/env";
import {
  checkForAppUpdate,
  downloadAndInstallAppUpdate,
  mapAppUpdateError,
} from "../services/appUpdate";
import { toast } from "../services/ui/toast";
import { fetchAppBuildInfo } from "../tauri/appInfoApi";

export function useAppUpdateCheckOnLaunch() {
  const checkedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState<string | undefined>();
  const pendingUpdateRef = useRef<Update | null>(null);

  useEffect(() => {
    if (!isTauriRuntime() || checkedRef.current) return;
    checkedRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const info = await fetchAppBuildInfo();
        if (cancelled) return;
        const result = await checkForAppUpdate(info.version);
        if (cancelled) return;
        if (result.kind === "available") {
          pendingUpdateRef.current = result.update;
          setVersion(result.version);
          setNotes(result.notes);
          setOpen(true);
        }
      } catch (error) {
        console.warn("[appUpdate] launch check failed", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

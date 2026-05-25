import { useCallback, useState } from "react";
import type { BusyReason } from "./useProjectCrudController";

type BusyPack = { busy: boolean; reason: BusyReason | null };

export interface ProjectBusyApi {
  busy: boolean;
  busyReason: BusyReason | null;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
}

export function useProjectBusyState(): ProjectBusyApi {
  const [busyPack, setBusyPack] = useState<BusyPack>({ busy: false, reason: null });
  const beginBusy = useCallback((reason: BusyReason) => {
    setBusyPack({ busy: true, reason });
  }, []);
  const endBusy = useCallback(() => {
    setBusyPack({ busy: false, reason: null });
  }, []);
  return { busy: busyPack.busy, busyReason: busyPack.reason, beginBusy, endBusy };
}

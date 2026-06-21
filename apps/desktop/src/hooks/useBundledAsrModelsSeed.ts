import { useCallback, useEffect, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "../config/env";
import { seedBundledAsrModelsIfNeeded } from "../tauri/projectAsrMaintenanceApi";
import { retryBundledAsrSidecar } from "../tauri/projectApi";
import {
  bundledSeedProgressLabel,
  computeBundledSeedWeightedPercent,
  listenBundledAsrModelsSeedProgress,
} from "../services/asr/bundledAsrModelsSeedProgress";
import { setBundledAsrModelsSeedActive } from "../services/asr/asrPrepareActivityGate";

export type BundledSeedGateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "seeding"; percent: number; message: string }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export function useBundledAsrModelsSeed() {
  const [gate, setGate] = useState<BundledSeedGateState>({ kind: "idle" });
  const startedRef = useRef(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const runSeed = useCallback(async () => {
    if (!isTauriRuntime()) {
      setGate({ kind: "ready" });
      return;
    }
    setGate({ kind: "checking" });
    setBundledAsrModelsSeedActive(true);
    let lastWeighted = 0;
    const unlisten = await listenBundledAsrModelsSeedProgress((progress) => {
      const weighted = computeBundledSeedWeightedPercent(
        progress.phase,
        progress.percent,
        lastWeighted,
      );
      lastWeighted = weighted;
      setGate({
        kind: "seeding",
        percent: weighted,
        message: bundledSeedProgressLabel(progress.phase, weighted),
      });
    });
    unlistenRef.current = unlisten;
    try {
      const result = await seedBundledAsrModelsIfNeeded();
      if (
        result.status === "skipped_no_bundle" ||
        result.status === "skipped_reseed" ||
        result.skipped_reseed
      ) {
        setGate({ kind: "ready" });
        return;
      }
      if (result.status === "seeded") {
        await retryBundledAsrSidecar();
        setGate({ kind: "ready" });
        return;
      }
      setGate({ kind: "ready" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGate({
        kind: "error",
        message: message || "内置语音模型准备失败，请重新安装应用。",
      });
    } finally {
      setBundledAsrModelsSeedActive(false);
      unlistenRef.current?.();
      unlistenRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runSeed();
    return () => {
      void unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, [runSeed]);

  const blocking =
    gate.kind === "checking" || gate.kind === "seeding" || gate.kind === "error";

  return { gate, blocking, retrySeed: runSeed };
}

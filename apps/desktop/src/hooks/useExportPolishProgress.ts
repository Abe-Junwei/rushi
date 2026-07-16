import { useEffect, useState } from "react";
import { isTauriRuntime } from "../config/env";
import {
  listenExportPolishProgress,
  type ExportPolishProgress,
} from "../services/exportPolishProgress";

/** 仅在 export_polish 忙碌期间订阅 Rust 批进度事件。 */
export function useExportPolishProgress(active: boolean): ExportPolishProgress | null {
  const [progress, setProgress] = useState<ExportPolishProgress | null>(null);

  useEffect(() => {
    if (!active || !isTauriRuntime()) {
      setProgress(null);
      return;
    }
    setProgress(null);
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    void listenExportPolishProgress((next) => {
      if (!cancelled) setProgress(next);
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [active]);

  return progress;
}

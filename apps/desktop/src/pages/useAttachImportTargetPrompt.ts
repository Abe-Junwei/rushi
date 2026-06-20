import { useCallback, useRef, useState } from "react";
import type { FileSummary } from "../tauri/projectTypes";

type AttachImportTargetPrompt = {
  srcPath: string;
  candidates: FileSummary[];
  transcriptStem: string;
};

export function useAttachImportTargetPrompt() {
  const [attachImportTarget, setAttachImportTarget] = useState<AttachImportTargetPrompt | null>(
    null,
  );
  const attachTargetResolverRef = useRef<((fileId: string | null) => void) | null>(null);

  const askAttachImportTarget = useCallback(
    (prompt: AttachImportTargetPrompt): Promise<string | null> => {
      return new Promise((resolve) => {
        attachTargetResolverRef.current = resolve;
        setAttachImportTarget(prompt);
      });
    },
    [],
  );

  const cancelAttachImportTarget = useCallback(() => {
    attachTargetResolverRef.current?.(null);
    attachTargetResolverRef.current = null;
    setAttachImportTarget(null);
  }, []);

  const confirmAttachImportTarget = useCallback((fileId: string) => {
    attachTargetResolverRef.current?.(fileId);
    attachTargetResolverRef.current = null;
    setAttachImportTarget(null);
  }, []);

  return {
    attachImportTargetOpen: attachImportTarget !== null,
    attachImportTargetCandidates: attachImportTarget?.candidates ?? [],
    attachImportTargetStem: attachImportTarget?.transcriptStem ?? null,
    askAttachImportTarget,
    cancelAttachImportTarget,
    confirmAttachImportTarget,
  };
}

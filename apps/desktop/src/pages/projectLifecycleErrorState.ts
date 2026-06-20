import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { humanizeInvokeError } from "../services/ui/humanizeInvokeError";
import { toast } from "../services/ui/toast";

export function useProjectLifecycleErrorState() {
  const [error, setErrorState] = useState<string>("");
  const lastToastedRef = useRef("");

  const setError = useCallback((value: SetStateAction<string>) => {
    setErrorState((prev) => (typeof value === "function" ? value(prev) : value));
  }, []);

  useEffect(() => {
    const trimmed = error.trim();
    const prevTrimmed = lastToastedRef.current;
    lastToastedRef.current = trimmed;
    if (trimmed && trimmed !== prevTrimmed) {
      toast.error(humanizeInvokeError(trimmed));
    }
  }, [error]);

  return { error, setError };
}

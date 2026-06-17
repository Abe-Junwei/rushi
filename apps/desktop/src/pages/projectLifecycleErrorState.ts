import { useCallback, useState, type SetStateAction } from "react";
import { humanizeInvokeError } from "../services/ui/humanizeInvokeError";
import { toast } from "../services/ui/toast";

export function useProjectLifecycleErrorState() {
  const [error, setErrorState] = useState<string>("");
  const setError = useCallback((value: SetStateAction<string>) => {
    setErrorState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      const trimmed = next.trim();
      if (trimmed && trimmed !== prev.trim()) {
        toast.error(humanizeInvokeError(trimmed));
      }
      return next;
    });
  }, []);

  return { error, setError };
}

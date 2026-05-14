import { useCallback, useEffect, useState } from "react";
import type { GlossaryTermDto } from "../tauri/glossaryApi";
import * as g from "../tauri/glossaryApi";

export type GlossaryControllerApi = ReturnType<typeof useGlossaryController>;

export function useGlossaryController() {
  const [terms, setTerms] = useState<GlossaryTermDto[]>([]);
  const [newTerm, setNewTerm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const list = await g.glossaryList();
      setTerms(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(async () => {
    const t = newTerm.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    try {
      await g.glossaryAdd(t);
      setNewTerm("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [newTerm, refresh]);

  const remove = useCallback(
    async (id: number) => {
      setBusy(true);
      setError("");
      try {
        await g.glossaryDelete(id);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { terms, newTerm, setNewTerm, error, busy, refresh, add, remove };
}

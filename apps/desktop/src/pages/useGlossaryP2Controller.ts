import { useCallback, useEffect, useState } from "react";
import type { GlossaryTermDto } from "../tauri/p2GlossaryApi";
import * as g from "../tauri/p2GlossaryApi";

export function useGlossaryP2Controller() {
  const [terms, setTerms] = useState<GlossaryTermDto[]>([]);
  const [newTerm, setNewTerm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const list = await g.p2GlossaryList();
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
      await g.p2GlossaryAdd(t);
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
        await g.p2GlossaryDelete(id);
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

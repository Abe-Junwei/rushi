import { useCallback, useState } from "react";
import type { GlossaryControllerApi } from "./useGlossaryController";

export function useGlossaryBulkAddDialog(g: GlossaryControllerApi) {
  const [open, setOpen] = useState(false);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  const confirm = useCallback(async () => {
    const ok = await g.bulkAdd();
    if (ok) setOpen(false);
  }, [g]);

  const importFromFile = useCallback(() => {
    setOpen(false);
    void g.importFromFile();
  }, [g]);

  return { open, openDialog, closeDialog, confirm, importFromFile };
}

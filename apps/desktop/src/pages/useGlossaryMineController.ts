import { useCallback, useEffect, useMemo, useState } from "react";
import { correctionGlossaryMineCandidates, type GlossaryLearnPromptRow } from "../tauri/correctionApi";
import { glossaryAdd } from "../tauri/glossaryApi";
import {
  dismissGlossaryPrompt,
  filterUndismissedPrompts,
} from "../utils/glossaryPromptDismiss";
import { toast } from "../services/ui/toast";

type Args = {
  onGlossaryChanged: () => void | Promise<void>;
};

export function useGlossaryMineController({ onGlossaryChanged }: Args) {
  const [rows, setRows] = useState<GlossaryLearnPromptRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const list = filterUndismissedPrompts(await correctionGlossaryMineCandidates());
      setRows(list);
      setChecked((prev) => {
        const next = new Set<string>();
        for (const r of list) {
          if (prev.has(r.afterText)) next.add(r.afterText);
        }
        return next;
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleCheckedCount = useMemo(
    () => rows.filter((r) => checked.has(r.afterText)).length,
    [checked, rows],
  );

  const allChecked = rows.length > 0 && visibleCheckedCount === rows.length;

  const toggleChecked = useCallback((afterText: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(afterText)) next.delete(afterText);
      else next.add(afterText);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setChecked((prev) => {
      if (rows.length > 0 && rows.every((r) => prev.has(r.afterText))) {
        return new Set();
      }
      return new Set(rows.map((r) => r.afterText));
    });
  }, [rows]);

  const dismissRows = useCallback((targets: GlossaryLearnPromptRow[]) => {
    for (const row of targets) {
      dismissGlossaryPrompt(row.afterText);
    }
    setRows((prev) => prev.filter((r) => !targets.some((t) => t.afterText === r.afterText)));
    setChecked((prev) => {
      const next = new Set(prev);
      for (const row of targets) next.delete(row.afterText);
      return next;
    });
  }, []);

  const adoptRows = useCallback(
    async (targets: GlossaryLearnPromptRow[]) => {
      if (!targets.length) return;
      setBusy(true);
      setLoadError("");
      try {
        let added = 0;
        for (const row of targets) {
          await glossaryAdd({
            term: row.afterText,
            aliases: "",
            domain: "",
            note: `纠错记忆推荐 · 命中 ${row.hitCount} 次${
              row.sampleBefore && row.sampleBefore !== row.afterText
                ? ` · 例 ${row.sampleBefore}→${row.afterText}`
                : ""
            }`,
            hotwordEnabled: true,
          });
          dismissGlossaryPrompt(row.afterText);
          added += 1;
        }
        dismissRows(targets);
        await onGlossaryChanged();
        await refresh();
        toast.success(
          added === 1
            ? `已将「${targets[0].afterText}」加入术语表并纳入热词`
            : `已将 ${added} 条加入术语表并纳入热词`,
        );
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [dismissRows, onGlossaryChanged, refresh],
  );

  const adoptChecked = useCallback(() => {
    const targets = rows.filter((r) => checked.has(r.afterText));
    void adoptRows(targets);
  }, [adoptRows, checked, rows]);

  const dismissChecked = useCallback(() => {
    const targets = rows.filter((r) => checked.has(r.afterText));
    dismissRows(targets);
  }, [checked, dismissRows, rows]);

  const adoptOne = useCallback(
    (row: GlossaryLearnPromptRow) => {
      void adoptRows([row]);
    },
    [adoptRows],
  );

  const dismissOne = useCallback(
    (row: GlossaryLearnPromptRow) => {
      dismissRows([row]);
    },
    [dismissRows],
  );

  return {
    rows,
    loadError,
    busy,
    checked,
    visibleCheckedCount,
    allChecked,
    refresh,
    toggleChecked,
    toggleAll,
    adoptChecked,
    dismissChecked,
    adoptOne,
    dismissOne,
  };
}

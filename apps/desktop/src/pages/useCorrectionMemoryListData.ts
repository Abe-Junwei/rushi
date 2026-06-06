import { useCallback, useEffect, useMemo, useState } from "react";
import { correctionMemoryList, type CorrectionMemoryEntryRow } from "../tauri/correctionApi";
import {
  correctionMemoryRowKey,
  filterCorrectionMemoryRows,
} from "../services/correctionMemoryHelpers";

export function useCorrectionMemoryListData() {
  const [rows, setRows] = useState<CorrectionMemoryEntryRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const list = await correctionMemoryList();
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRows = useMemo(
    () => filterCorrectionMemoryRows(rows, searchQuery),
    [rows, searchQuery],
  );

  const visibleRowKeys = useMemo(
    () => filteredRows.map((row) => correctionMemoryRowKey(row)),
    [filteredRows],
  );

  const stableCount = useMemo(() => rows.filter((r) => r.isStable).length, [rows]);

  return {
    rows,
    loadError,
    setLoadError,
    searchQuery,
    setSearchQuery,
    refresh,
    filteredRows,
    visibleRowKeys,
    stableCount,
  };
}

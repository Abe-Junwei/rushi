import { useCallback, useState } from "react";
import {
  EMPTY_GLOSSARY_DRAFT,
  glossaryDraftFromTerm,
  glossaryDraftHasTerm,
  type GlossaryEditorDraft,
} from "../services/glossaryTermHelpers";
import type { GlossaryTermDto } from "../tauri/glossaryApi";
import * as g from "../tauri/glossaryApi";

export function useGlossaryEditor(
  refresh: () => Promise<void>,
  setError: (msg: string) => void,
  setStatusMessage: (msg: string) => void,
  setBusy: (busy: boolean) => void,
) {
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<GlossaryEditorDraft>(EMPTY_GLOSSARY_DRAFT);

  const resetEditor = useCallback(() => {
    setEditorMode("create");
    setSelectedId(null);
    setDraft(EMPTY_GLOSSARY_DRAFT);
  }, []);

  const selectTerm = useCallback(
    (row: GlossaryTermDto) => {
      setEditorMode("edit");
      setSelectedId(row.id);
      setDraft(glossaryDraftFromTerm(row));
      setStatusMessage("");
      setError("");
    },
    [setError, setStatusMessage],
  );

  const updateDraftField = useCallback((key: keyof GlossaryEditorDraft, value: string | boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const syncDraftHotword = useCallback((enabled: boolean) => {
    setDraft((prev) => ({ ...prev, hotwordEnabled: enabled }));
  }, []);

  const saveDraft = useCallback(async () => {
    if (!glossaryDraftHasTerm(draft)) {
      setError("请填写主术语。");
      return;
    }
    setBusy(true);
    setError("");
    setStatusMessage("");
    const input = {
      term: draft.term.trim(),
      aliases: draft.aliases.trim(),
      domain: draft.domain.trim(),
      note: draft.note.trim(),
      hotwordEnabled: draft.hotwordEnabled,
    };
    try {
      if (editorMode === "edit" && selectedId != null) {
        await g.glossaryUpdate(selectedId, input);
        setStatusMessage("已保存修改。");
      } else {
        await g.glossaryAdd(input);
        setStatusMessage("已添加词条。");
        resetEditor();
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [draft, editorMode, refresh, resetEditor, selectedId, setBusy, setError, setStatusMessage]);

  const remove = useCallback(
    async (id: number, removeFromSelection: (id: number) => void) => {
      setBusy(true);
      setError("");
      try {
        await g.glossaryDelete(id);
        if (selectedId === id) {
          resetEditor();
        }
        removeFromSelection(id);
        await refresh();
        setStatusMessage("已删除。");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh, resetEditor, selectedId, setBusy, setError, setStatusMessage],
  );

  return {
    editorMode,
    selectedId,
    draft,
    resetEditor,
    selectTerm,
    updateDraftField,
    syncDraftHotword,
    saveDraft,
    remove,
  };
}

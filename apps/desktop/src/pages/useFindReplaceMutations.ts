import { useCallback } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { publishSegmentTextBulkMutation } from "./flushSegmentTextDrafts";
import {
  applyReplaceAllToSegments,
  buildReplaceAllPreviewRows,
  clampMatchIndex,
  collectLiteralFindMatches,
  replaceOnceInText,
  type FindMatch,
} from "../services/editor/segmentFindReplace";
import { toast } from "../services/ui/toast";

type Args = {
  busy: boolean;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  updateSegmentText: (idx: number, text: string) => void;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  pushUndo: () => void;
  saveSegments: (options?: {
    quiet?: boolean;
    countHits?: boolean;
    explicitPairs?: import("../tauri/fileApi").CorrectionExplicitPair[];
  }) => Promise<boolean>;
  findText: string;
  replaceText: string;
  activeMatchIndex: number;
  matches: FindMatch[];
  applySearchResults: (nextMatches: FindMatch[], preferredIndex?: number) => void;
  closeFindReplace: () => void;
  onRequestReplaceAllPreview: (rows: ReturnType<typeof buildReplaceAllPreviewRows>) => void;
};

export function useFindReplaceMutations(args: Args) {
  const {
    busy,
    segmentsRef,
    flushSegmentTextDrafts,
    updateSegmentText,
    setSegments,
    pushUndo,
    saveSegments,
    findText,
    replaceText,
    activeMatchIndex,
    matches,
    applySearchResults,
    closeFindReplace,
    onRequestReplaceAllPreview,
  } = args;

  const findReplaceCurrent = useCallback(() => {
    if (!findText || activeMatchIndex < 0) return;
    const match = matches[activeMatchIndex];
    if (!match) return;
    flushSegmentTextDrafts();
    const row = segmentsRef.current[match.segmentIdx];
    if (!row) return;
    const nextText = replaceOnceInText(row.text, match.charStart, findText, replaceText);
    if (nextText === row.text) return;
    updateSegmentText(match.segmentIdx, nextText);
    const projected = segmentsRef.current.map((s, i) =>
      i === match.segmentIdx ? { ...s, text: nextText } : s,
    );
    const nextMatches = collectLiteralFindMatches(projected, findText);
    const nextActive = clampMatchIndex(
      Math.min(activeMatchIndex, Math.max(0, nextMatches.length - 1)),
      nextMatches.length,
    );
    applySearchResults(nextMatches, nextActive >= 0 ? nextActive : undefined);
  }, [
    activeMatchIndex,
    applySearchResults,
    findText,
    flushSegmentTextDrafts,
    matches,
    replaceText,
    segmentsRef,
    updateSegmentText,
  ]);

  const findReplaceReplaceAndNext = useCallback(() => {
    if (!findText || activeMatchIndex < 0) return;
    const match = matches[activeMatchIndex];
    if (!match) return;
    flushSegmentTextDrafts();
    const row = segmentsRef.current[match.segmentIdx];
    if (!row) return;
    const nextText = replaceOnceInText(row.text, match.charStart, findText, replaceText);
    if (nextText !== row.text) {
      updateSegmentText(match.segmentIdx, nextText);
    }
    const projected = segmentsRef.current.map((s, i) =>
      i === match.segmentIdx ? { ...s, text: nextText } : s,
    );
    const nextMatches = collectLiteralFindMatches(projected, findText);
    if (!nextMatches.length) {
      applySearchResults(nextMatches);
      return;
    }
    const next = (activeMatchIndex + 1) % nextMatches.length;
    applySearchResults(nextMatches, next);
  }, [
    activeMatchIndex,
    applySearchResults,
    findText,
    flushSegmentTextDrafts,
    matches,
    replaceText,
    segmentsRef,
    updateSegmentText,
  ]);

  const findReplaceRequestReplaceAll = useCallback(() => {
    if (!findText || !matches.length) return;
    flushSegmentTextDrafts();
    const rows = buildReplaceAllPreviewRows(segmentsRef.current, findText, replaceText, matches);
    onRequestReplaceAllPreview(rows);
  }, [findText, flushSegmentTextDrafts, matches, onRequestReplaceAllPreview, replaceText, segmentsRef]);

  const findReplaceConfirmReplaceAll = useCallback(async () => {
    if (!findText || !matches.length || busy) return;
    const matchCount = matches.length;
    flushSegmentTextDrafts();
    pushUndo();
    const next = applyReplaceAllToSegments(segmentsRef.current, findText, replaceText, matches);
    publishSegmentTextBulkMutation(segmentsRef, setSegments, next);
    const explicitPairs =
      findText.trim() !== replaceText.trim()
        ? [{ beforeText: findText.trim(), afterText: replaceText.trim() }]
        : undefined;
    const saved = await saveSegments({ quiet: true, countHits: true, explicitPairs });
    if (!saved) {
      toast.warning("已全部替换，但保存失败，请稍后手动保存以写入纠错记忆");
      return;
    }
    closeFindReplace();
    if (findText !== replaceText) {
      toast.success(`已替换 ${matchCount} 处并已保存；符合条件的将写入纠错记忆`);
    } else {
      toast.info(`已处理 ${matchCount} 处并已保存`);
    }
  }, [
    busy,
    closeFindReplace,
    findText,
    flushSegmentTextDrafts,
    matches,
    pushUndo,
    replaceText,
    saveSegments,
    segmentsRef,
    setSegments,
  ]);

  return {
    findReplaceCurrent,
    findReplaceReplaceAndNext,
    findReplaceRequestReplaceAll,
    findReplaceConfirmReplaceAll,
  };
}

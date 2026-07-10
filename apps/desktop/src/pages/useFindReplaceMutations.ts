import { useCallback } from "react";
import {
  applyReplaceAllToSegments,
  buildReplaceAllPreviewRows,
  clampMatchIndex,
  collectLiteralFindMatches,
  replaceOnceInText,
  type FindMatch,
} from "../services/editor/segmentFindReplace";
import { toast } from "../services/ui/toast";
import type { SegmentPublishApi } from "./segmentPublishApi";
import { readTranscriptEditorCoreEnabled } from "../components/editor/core/transcriptEditorCoreFlag";
import {
  dispatchTranscriptApplyTextsBulk,
  dispatchTranscriptReplaceCharRange,
} from "../components/editor/core/transcriptEditorViewHandle";

type Args = {
  busy: boolean;
  segmentPublish: SegmentPublishApi;
  flushSegmentTextDrafts: () => void;
  updateSegmentText: (idx: number, text: string) => void;
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
    segmentPublish,
    flushSegmentTextDrafts,
    updateSegmentText,
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

  const getCurrentSegmentsSnapshot = segmentPublish.getCurrentSegmentsSnapshot;

  const currentMatchesAfterDraftFlush = useCallback(() => {
    flushSegmentTextDrafts();
    return collectLiteralFindMatches(getCurrentSegmentsSnapshot(), findText);
  }, [findText, flushSegmentTextDrafts, getCurrentSegmentsSnapshot]);

  const applyOneReplace = useCallback(
    (match: FindMatch, nextText: string) => {
      if (
        readTranscriptEditorCoreEnabled() &&
        dispatchTranscriptReplaceCharRange(
          match.segmentIdx,
          match.charStart,
          findText.length,
          replaceText,
        )
      ) {
        updateSegmentText(match.segmentIdx, nextText);
        return;
      }
      updateSegmentText(match.segmentIdx, nextText);
    },
    [findText.length, replaceText, updateSegmentText],
  );

  const findReplaceCurrent = useCallback(() => {
    if (!findText || activeMatchIndex < 0) return;
    const currentMatches = currentMatchesAfterDraftFlush();
    const match = currentMatches[clampMatchIndex(activeMatchIndex, currentMatches.length)];
    if (!match) return;
    const row = getCurrentSegmentsSnapshot()[match.segmentIdx];
    if (!row) return;
    const nextText = replaceOnceInText(row.text, match.charStart, findText, replaceText);
    if (nextText === row.text) return;
    applyOneReplace(match, nextText);
    const projected = getCurrentSegmentsSnapshot().map((s, i) =>
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
    applyOneReplace,
    applySearchResults,
    currentMatchesAfterDraftFlush,
    findText,
    getCurrentSegmentsSnapshot,
    replaceText,
  ]);

  const findReplaceReplaceAndNext = useCallback(() => {
    if (!findText || activeMatchIndex < 0) return;
    const currentMatches = currentMatchesAfterDraftFlush();
    const match = currentMatches[clampMatchIndex(activeMatchIndex, currentMatches.length)];
    if (!match) return;
    const row = getCurrentSegmentsSnapshot()[match.segmentIdx];
    if (!row) return;
    const nextText = replaceOnceInText(row.text, match.charStart, findText, replaceText);
    if (nextText !== row.text) {
      applyOneReplace(match, nextText);
    }
    const projected = getCurrentSegmentsSnapshot().map((s, i) =>
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
    applyOneReplace,
    applySearchResults,
    currentMatchesAfterDraftFlush,
    findText,
    replaceText,
    getCurrentSegmentsSnapshot,
  ]);

  const findReplaceRequestReplaceAll = useCallback(() => {
    if (!findText || !matches.length) return;
    const currentMatches = currentMatchesAfterDraftFlush();
    const rows = buildReplaceAllPreviewRows(getCurrentSegmentsSnapshot(), findText, replaceText, currentMatches);
    onRequestReplaceAllPreview(rows);
  }, [currentMatchesAfterDraftFlush, findText, getCurrentSegmentsSnapshot, matches.length, onRequestReplaceAllPreview, replaceText]);

  const findReplaceConfirmReplaceAll = useCallback(async () => {
    if (!findText || !matches.length || busy) return;
    const currentMatches = currentMatchesAfterDraftFlush();
    if (!currentMatches.length) return;
    const matchCount = currentMatches.length;
    pushUndo();
    const baseline = getCurrentSegmentsSnapshot();
    const next = applyReplaceAllToSegments(baseline, findText, replaceText, currentMatches);
    if (readTranscriptEditorCoreEnabled()) {
      const updates = next
        .map((s, i) => ({ segmentIdx: i, text: s.text ?? "" }))
        .filter((u, i) => (baseline[i]?.text ?? "") !== u.text);
      dispatchTranscriptApplyTextsBulk(updates);
    }
    segmentPublish.publishTextBulk(next);
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
    currentMatchesAfterDraftFlush,
    findText,
    matches.length,
    pushUndo,
    replaceText,
    getCurrentSegmentsSnapshot,
    saveSegments,
    segmentPublish,
  ]);

  return {
    findReplaceCurrent,
    findReplaceReplaceAndNext,
    findReplaceRequestReplaceAll,
    findReplaceConfirmReplaceAll,
  };
}

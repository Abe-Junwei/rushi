import { memo, useEffect, useMemo, useState } from "react";
import type { SegmentContextMenuOpen } from "../../utils/segmentContextMenuModel";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import {
  isSegmentListFilterHidingPrimary,
  type SegmentListFilterNavState,
} from "../../utils/segmentListFilterNav";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";
import type { SegmentListFilterState } from "../../services/segmentListFilter";
import { TranscriptEditorCore } from "./core/TranscriptEditorCore";
import { CONTROL_BTN_LINK } from "../../config/controlStyles";
import { dispatchSegmentLoopButtonClick } from "../../utils/dispatchSegmentLoopButtonClick";
import * as fileApi from "../../tauri/fileApi";
import type { FileSpeakerDto } from "../../tauri/projectTypes";
import { buildSpeakerLabelMap, resolveSpeakerLabel } from "../../services/speakerLabels";
import { readTranscriptSelectedSegmentIndices } from "./core/transcriptEditorViewHandle";
import {
  CONTROL_BTN_SECONDARY,
  CONTROL_SELECT_INLINE,
  CONTROL_TEXT_INPUT,
} from "../../config/controlStyles";

type SegmentCtxMenuState = SegmentContextMenuOpen;

type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;

interface EditorSegmentListProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  appearance: AppearanceApi;
  listRef: React.RefObject<HTMLDivElement | null>;
  filterNavRef: React.MutableRefObject<SegmentListFilterNavState>;
  filteredIndices: number[];
  filterActive: boolean;
  filterCriteria?: SegmentListFilterState | null;
  visibleIndexSet?: ReadonlySet<number> | null;
  displayPositionByIndex?: ReadonlyMap<number, number> | null;
  onResetSegmentListFilter?: () => void;
  onOpenSegmentContextMenu: (menu: SegmentCtxMenuState) => void;
  onOpenSegmentAnnotationDialog?: (segmentIdx: number) => void;
}

export const EditorSegmentList = memo(function EditorSegmentList({
  controller: c,
  tx,
  appearance: a,
  listRef: segmentListRef,
  filterNavRef,
  filteredIndices,
  filterActive,
  filterCriteria = null,
  onResetSegmentListFilter,
  onOpenSegmentContextMenu,
  onOpenSegmentAnnotationDialog,
}: EditorSegmentListProps) {
  const [speakers, setSpeakers] = useState<FileSpeakerDto[]>([]);
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const [renameSpeakerId, setRenameSpeakerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [speakerBusy, setSpeakerBusy] = useState(false);
  const speakerSignature = c.segments.map((segment) => segment.speaker_id ?? "").join("|");

  useEffect(() => {
    let cancelled = false;
    if (!c.currentFileId) {
      setSpeakers([]);
      return;
    }
    void fileApi.loadFile(c.currentFileId).then((detail) => {
      if (!cancelled) setSpeakers(detail.speakers ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [c.currentFileId, speakerSignature]);

  useEffect(() => {
    setSpeakerFilter("all");
    setRenameSpeakerId(null);
  }, [c.currentFileId]);

  const speakerLabels = useMemo(() => buildSpeakerLabelMap(speakers), [speakers]);
  const effectiveFilteredIndices = useMemo(() => {
    if (speakerFilter === "all") return filteredIndices;
    return filteredIndices.filter((idx) => {
      const id = c.segments[idx]?.speaker_id ?? null;
      return speakerFilter === "unassigned" ? id == null : id === speakerFilter;
    });
  }, [c.segments, filteredIndices, speakerFilter]);
  const effectiveFilterActive = filterActive || speakerFilter !== "all";
  const effectiveVisibleSet = useMemo(
    () => (effectiveFilterActive ? new Set(effectiveFilteredIndices) : null),
    [effectiveFilterActive, effectiveFilteredIndices],
  );
  const effectiveDisplayPositions = useMemo(() => {
    if (!effectiveFilterActive) return null;
    return new Map(effectiveFilteredIndices.map((idx, position) => [idx, position]));
  }, [effectiveFilterActive, effectiveFilteredIndices]);
  const displayCount = effectiveFilteredIndices.length;

  const selectedIndices = () => {
    const indices = readTranscriptSelectedSegmentIndices();
    return indices.length > 0 ? indices : [c.selectedIdx];
  };

  const reassignSelected = (speakerId: string | null) => {
    if (!c.currentFileId) return;
    c.reassignSegmentsSpeaker(selectedIndices(), speakerId);
  };

  const createAndAssignSpeaker = async () => {
    if (!c.currentFileId) return;
    setSpeakerBusy(true);
    try {
      const speaker = await fileApi.fileCreateSpeaker(c.currentFileId);
      setSpeakers((current) => [...current, speaker]);
      c.reassignSegmentsSpeaker(selectedIndices(), speaker.speaker_id);
    } catch (error) {
      c.setError(error instanceof Error ? error.message : String(error));
    } finally {
      setSpeakerBusy(false);
    }
  };

  const confirmRename = async () => {
    if (!c.currentFileId || !renameSpeakerId) return;
    const fileId = c.currentFileId;
    const speakerId = renameSpeakerId;
    const previousName =
      speakers.find((speaker) => speaker.speaker_id === speakerId)?.display_name ?? null;
    const nextName = renameValue.trim() || null;
    if (previousName === nextName) {
      setRenameSpeakerId(null);
      return;
    }
    setSpeakerBusy(true);
    try {
      await fileApi.fileRenameSpeaker(fileId, speakerId, nextName);
      setRenameSpeakerId(null);
      const detail = await fileApi.loadFile(fileId);
      setSpeakers(detail.speakers ?? []);
      const applyHistoryName = async (displayName: string | null) => {
        try {
          await fileApi.fileRenameSpeaker(fileId, speakerId, displayName);
          const refreshed = await fileApi.loadFile(fileId);
          setSpeakers(refreshed.speakers ?? []);
        } catch (error) {
          c.setError(error instanceof Error ? error.message : String(error));
        }
      };
      c.pushExternalHistoryAction({
        undo: () => applyHistoryName(previousName),
        redo: () => applyHistoryName(nextName),
      });
    } catch (error) {
      c.setError(error instanceof Error ? error.message : String(error));
    } finally {
      setSpeakerBusy(false);
    }
  };

  useEffect(() => {
    filterNavRef.current = {
      active: filterActive,
      indices: effectiveFilteredIndices,
      visibleIndexSet: effectiveVisibleSet,
      displayPositionByIndex: effectiveDisplayPositions,
    };
  }, [effectiveFilterActive, effectiveFilteredIndices, effectiveVisibleSet, effectiveDisplayPositions, filterNavRef]);

  if (c.segments.length === 0) {
    return (
      <div className="flex h-0 min-h-0 flex-1 items-center justify-center px-6 text-title leading-relaxed text-notion-text-muted">
        尚未有语段：请先点击「自动转录」。
      </div>
    );
  }

  if (effectiveFilterActive && displayCount === 0) {
    return (
      <div
        ref={segmentListRef}
        className="flex h-0 min-h-0 flex-1 items-center justify-center px-6 text-title leading-relaxed text-notion-text-muted"
      >
        无匹配语段。
      </div>
    );
  }

  const panelHighlight =
    c.findReplaceEditorHighlight ?? c.correctionRulesEditorHighlight ?? null;
  const showFilteredSelectedBanner = isSegmentListFilterHidingPrimary({
    filterActive: effectiveFilterActive,
    filteredIndices: effectiveFilteredIndices,
    primaryIdx: c.selectedIdx,
    segmentCount: c.segments.length,
    visibleIndexSet: effectiveVisibleSet,
  });

  return (
    <div className="relative flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      {speakers.length > 0 || c.segments.some((segment) => segment.speaker_id) ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-notion-border bg-notion-sidebar px-3 py-2 text-sm text-notion-text-muted">
          <span className="font-medium text-notion-text">说话人</span>
          <select
            className={CONTROL_SELECT_INLINE}
            aria-label="按说话人筛选"
            value={speakerFilter}
            onChange={(event) => setSpeakerFilter(event.currentTarget.value)}
          >
            <option value="all">全部</option>
            {speakers.map((speaker) => (
              <option key={speaker.speaker_id} value={speaker.speaker_id}>
                {resolveSpeakerLabel(speaker.speaker_id, speakers)}
              </option>
            ))}
            <option value="unassigned">未标注</option>
          </select>
          <select
            className={CONTROL_SELECT_INLINE}
            aria-label="更改所选语段说话人"
            defaultValue=""
            disabled={speakerBusy}
            onChange={(event) => {
              const value = event.currentTarget.value;
              event.currentTarget.value = "";
              if (value === "new") void createAndAssignSpeaker();
              else if (value === "unassigned") reassignSelected(null);
              else if (value) reassignSelected(value);
            }}
          >
            <option value="">更改所选语段…</option>
            {speakers.map((speaker) => (
              <option key={speaker.speaker_id} value={speaker.speaker_id}>
                {resolveSpeakerLabel(speaker.speaker_id, speakers)}
              </option>
            ))}
            <option value="new">新建说话人</option>
            <option value="unassigned">设为未标注</option>
          </select>
          {renameSpeakerId ? (
            <>
              <input
                className={CONTROL_TEXT_INPUT}
                aria-label="说话人显示名"
                value={renameValue}
                autoFocus
                onChange={(event) => setRenameValue(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void confirmRename();
                  if (event.key === "Escape") setRenameSpeakerId(null);
                }}
              />
              <button className={CONTROL_BTN_SECONDARY} disabled={speakerBusy} onClick={() => void confirmRename()}>
                保存姓名
              </button>
            </>
          ) : (
            <button
              className={CONTROL_BTN_SECONDARY}
              disabled={speakerBusy || speakers.length === 0}
              onClick={() => {
                const target = speakers.find((speaker) => speaker.speaker_id === speakerFilter) ?? speakers[0];
                if (!target) return;
                setRenameSpeakerId(target.speaker_id);
                setRenameValue(target.display_name ?? "");
              }}
            >
              重命名
            </button>
          )}
        </div>
      ) : null}
      {showFilteredSelectedBanner ? (
        <div className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-notion-border bg-notion-sidebar px-3 py-2 text-sm text-notion-text">
          <span>所选语段不在当前筛选结果中</span>
          {onResetSegmentListFilter ? (
            <button
              type="button"
              className={`shrink-0 ${CONTROL_BTN_LINK}`}
              onClick={onResetSegmentListFilter}
            >
              清除过滤并定位
            </button>
          ) : null}
        </div>
      ) : null}
      <TranscriptEditorCore
        segments={c.segments}
        speakerLabels={speakerLabels}
        fileId={c.currentFileId}
        initialPrimaryIdxRef={c.selectedIdxRef}
        busy={c.busy}
        fontPx={tx.transcriptFontPx}
        fontFamily={a.transcriptFontFamily}
        fontWeight={a.transcriptFontWeight}
        fontItalic={a.transcriptFontItalic}
        updateSegmentText={c.updateSegmentText}
        panelHighlight={panelHighlight}
        filterActive={effectiveFilterActive}
        filteredIndices={effectiveFilteredIndices}
        filterCriteria={filterCriteria}
        listRef={segmentListRef}
        onOpenSegmentAnnotationDialog={onOpenSegmentAnnotationDialog}
        onOpenContextMenu={({ x, y, segmentIdx, pointerTimeSec, selectionText }) => {
          onOpenSegmentContextMenu({
            x,
            y,
            segmentIdx,
            pointerTimeSec,
            origin: "segmentList",
            selectionText,
          });
        }}
        onSelectSegment={(idx, opts) => {
          tx.selectSegmentFromList(idx, {
            shiftKey: opts?.shiftKey,
            toggle: opts?.toggle,
          });
        }}
        isSelectedSegmentPlaying={tx.isSelectedSegmentPlaying}
        segmentLoopPlayback={tx.segmentLoopPlayback}
        onToggleSegmentPlay={(idx) => {
          if (tx.isSelectedSegmentPlaying && c.selectedIdx === idx) {
            void tx.handleToggleSelectedWaveformPlay();
            return;
          }
          if (c.selectedIdx !== idx) {
            tx.selectSegmentFromList(idx, { suppressStickyListenJump: true });
          }
          void tx.playSegmentAtIndex(idx, { mode: "scoped" });
        }}
        onToggleSegmentLoop={(idx) => {
          dispatchSegmentLoopButtonClick({
            clickedIdx: idx,
            selectedIdx: c.selectedIdx,
            preserveLoopForNextSegmentSelect: tx.preserveLoopForNextSegmentSelect,
            selectSegment: (i, options) => tx.selectSegmentFromList(i, options),
            playSegmentAtIndex: (i, options) => tx.playSegmentAtIndex(i, options),
            toggleSelectedLoop: () => tx.handleToggleSelectedWaveformLoop(),
          });
        }}
        rowHeightDragFromDom={tx.beginTranscriptRowHeightDragFromDom}
      />
    </div>
  );
}, areEditorSegmentListPropsEqual);

function areEditorSegmentListPropsEqual(
  prev: EditorSegmentListProps,
  next: EditorSegmentListProps,
): boolean {
  if (prev.controller.busy !== next.controller.busy) return false;
  if (prev.controller.currentFileId !== next.controller.currentFileId) return false;
  if (prev.controller.segments !== next.controller.segments) return false;
  if (prev.controller.segments.length !== next.controller.segments.length) return false;
  if (prev.controller.selectedIdx !== next.controller.selectedIdx) return false;
  if (prev.filteredIndices !== next.filteredIndices) return false;
  if (prev.filterActive !== next.filterActive) return false;
  if (prev.filterCriteria !== next.filterCriteria) return false;
  if (prev.visibleIndexSet !== next.visibleIndexSet) return false;
  if (prev.displayPositionByIndex !== next.displayPositionByIndex) return false;
  if (prev.controller.findReplaceEditorHighlight !== next.controller.findReplaceEditorHighlight) {
    return false;
  }
  if (prev.controller.correctionRulesEditorHighlight !== next.controller.correctionRulesEditorHighlight) {
    return false;
  }
  if (prev.controller.updateSegmentText !== next.controller.updateSegmentText) return false;
  if (prev.tx.transcriptFontPx !== next.tx.transcriptFontPx) return false;
  if (prev.tx.beginTranscriptRowHeightDragFromDom !== next.tx.beginTranscriptRowHeightDragFromDom) {
    return false;
  }
  if (prev.appearance.transcriptFontFamily !== next.appearance.transcriptFontFamily) return false;
  if (prev.appearance.transcriptFontWeight !== next.appearance.transcriptFontWeight) return false;
  if (prev.appearance.transcriptFontItalic !== next.appearance.transcriptFontItalic) return false;
  if (prev.tx.selectSegmentFromList !== next.tx.selectSegmentFromList) return false;
  if (prev.tx.isSelectedSegmentPlaying !== next.tx.isSelectedSegmentPlaying) return false;
  if (prev.tx.segmentLoopPlayback !== next.tx.segmentLoopPlayback) return false;
  if (prev.tx.handleToggleSelectedWaveformPlay !== next.tx.handleToggleSelectedWaveformPlay) {
    return false;
  }
  if (prev.tx.handleToggleSelectedWaveformLoop !== next.tx.handleToggleSelectedWaveformLoop) {
    return false;
  }
  if (prev.tx.playSegmentAtIndex !== next.tx.playSegmentAtIndex) return false;
  if (prev.tx.preserveLoopForNextSegmentSelect !== next.tx.preserveLoopForNextSegmentSelect) {
    return false;
  }
  if (prev.appearance !== next.appearance) return false;
  if (prev.onResetSegmentListFilter !== next.onResetSegmentListFilter) return false;
  if (prev.onOpenSegmentContextMenu !== next.onOpenSegmentContextMenu) return false;
  if (prev.onOpenSegmentAnnotationDialog !== next.onOpenSegmentAnnotationDialog) return false;
  return true;
}

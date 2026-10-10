import { memo, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
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
import { CONTROL_BTN_LINK, CONTROL_SELECT_INLINE } from "../../config/controlStyles";
import { dispatchSegmentLoopButtonClick } from "../../utils/dispatchSegmentLoopButtonClick";
import * as fileApi from "../../tauri/fileApi";
import type { FileSpeakerDto } from "../../tauri/projectTypes";
import { buildSpeakerLabelMap, resolveSpeakerLabel } from "../../services/speakerLabels";
import { readTranscriptSelectedSegmentIndices } from "./core/transcriptEditorViewHandle";
import { SpeakerRenameDialog } from "../SpeakerRenameDialog";

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
  speakers: FileSpeakerDto[];
  setSpeakers: Dispatch<SetStateAction<FileSpeakerDto[]>>;
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
  visibleIndexSet = null,
  displayPositionByIndex = null,
  speakers,
  setSpeakers,
  onResetSegmentListFilter,
  onOpenSegmentContextMenu,
  onOpenSegmentAnnotationDialog,
}: EditorSegmentListProps) {
  const [renameSpeakerId, setRenameSpeakerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [speakerBusy, setSpeakerBusy] = useState(false);

  const speakerLabels = useMemo(() => buildSpeakerLabelMap(speakers), [speakers]);
  const displayCount = filteredIndices.length;

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
      indices: filteredIndices,
      visibleIndexSet,
      displayPositionByIndex,
    };
  }, [filterActive, filteredIndices, visibleIndexSet, displayPositionByIndex, filterNavRef]);

  if (c.segments.length === 0) {
    return (
      <div className="flex h-0 min-h-0 flex-1 items-center justify-center px-6 text-title leading-relaxed text-notion-text-muted">
        尚未有语段：请先点击「自动转录」。
      </div>
    );
  }

  if (filterActive && displayCount === 0) {
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
    filterActive,
    filteredIndices,
    primaryIdx: c.selectedIdx,
    segmentCount: c.segments.length,
    visibleIndexSet,
  });
  const showReassignBar =
    speakers.length > 0 || c.segments.some((segment) => segment.speaker_id);
  const renamePlaceholder =
    resolveSpeakerLabel(renameSpeakerId, speakers) ?? "说话人";

  return (
    <div className="relative flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      {showReassignBar ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-notion-border bg-notion-sidebar px-3 py-2 text-sm text-notion-text-muted">
          <span className="font-medium text-notion-text">说话人</span>
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
        filterActive={filterActive}
        filteredIndices={filteredIndices}
        filterCriteria={filterCriteria}
        listRef={segmentListRef}
        onOpenSegmentAnnotationDialog={onOpenSegmentAnnotationDialog}
        onRenameSpeaker={(speakerId) => {
          const target = speakers.find((speaker) => speaker.speaker_id === speakerId);
          setRenameSpeakerId(speakerId);
          setRenameValue(target?.display_name ?? "");
        }}
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
      <SpeakerRenameDialog
        open={renameSpeakerId != null}
        busy={speakerBusy}
        value={renameValue}
        placeholder={renamePlaceholder}
        onChange={setRenameValue}
        onCancel={() => setRenameSpeakerId(null)}
        onConfirm={() => void confirmRename()}
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
  if (prev.speakers !== next.speakers) return false;
  if (prev.setSpeakers !== next.setSpeakers) return false;
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

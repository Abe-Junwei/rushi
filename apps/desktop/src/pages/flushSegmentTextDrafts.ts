import { flushSync } from "react-dom";
import type { SegmentDto } from "../tauri/projectApi";
import { getTranscriptEditorView } from "../components/editor/core/transcriptEditorViewHandle";
import { readTranscriptEditorSelectionText } from "../components/editor/core/textEditCommands";
import { isTranscriptEditorCoreFocused } from "../components/editor/core/transcriptEditorDom";

export { resolveLiveSegmentText } from "../utils/segmentTextNormalize";

/** @deprecated CM6 has no per-row textarea; kept for call-site string checks that should migrate. */
export const TRANSCRIPT_TEXTAREA_SELECTOR = 'textarea[aria-label="语段正文"]';

/** Selection text inside CM6 when core is focused. */
export function readFocusedTranscriptTextareaSelection(): string {
  if (!isTranscriptEditorCoreFocused()) return "";
  const view = getTranscriptEditorView();
  if (!view) return "";
  return readTranscriptEditorSelectionText(view);
}

type SegmentListSetter =
  | React.Dispatch<React.SetStateAction<SegmentDto[]>>
  | ((next: React.SetStateAction<SegmentDto[]>) => void);

export type SegmentListNext = SegmentDto[] | ((prev: SegmentDto[]) => SegmentDto[]);

type SegmentSnapshotGetter = () => SegmentDto[];

function resolveSegmentListNext(prev: SegmentDto[], next: SegmentListNext): SegmentDto[] {
  return typeof next === "function" ? next(prev) : next;
}

function publishResolvedSegments(
  getCurrentSegmentsSnapshot: SegmentSnapshotGetter,
  setSegments: SegmentListSetter,
  resolve: (prev: SegmentDto[]) => SegmentDto[],
): SegmentDto[] {
  let resolved: SegmentDto[] | null = null;
  flushSync(() => {
    setSegments((prev) => {
      resolved = resolve(prev);
      return resolved;
    });
  });
  return resolved ?? getCurrentSegmentsSnapshot();
}

function publishResolvedSegmentsAsync(
  getCurrentSegmentsSnapshot: SegmentSnapshotGetter,
  setSegments: SegmentListSetter,
  resolve: (prev: SegmentDto[]) => SegmentDto[],
): SegmentDto[] {
  const resolved = resolve(getCurrentSegmentsSnapshot());
  setSegments(resolved);
  return resolved;
}

/** 结构变更后：同步 React state；当前快照由 render 后的 publish 边界维护。 */
export function publishSegmentStructureMutation(
  getCurrentSegmentsSnapshot: SegmentSnapshotGetter,
  setSegments: SegmentListSetter,
  next: SegmentListNext,
): SegmentDto[] {
  return publishResolvedSegments(getCurrentSegmentsSnapshot, setSegments, (prev) =>
    resolveSegmentListNext(prev, next),
  );
}

/** 批量写回语段正文后：刷新 state（CM6 为会话真源，无 draft/DOM 同步）。 */
export function publishSegmentTextBulkMutation(
  getCurrentSegmentsSnapshot: SegmentSnapshotGetter,
  setSegments: SegmentListSetter,
  next: SegmentListNext,
): SegmentDto[] {
  return publishResolvedSegmentsAsync(getCurrentSegmentsSnapshot, setSegments, (prev) =>
    resolveSegmentListNext(prev, next),
  );
}

/** 转写开始前清空语段。 */
export function publishTranscribeSegmentClear(
  getCurrentSegmentsSnapshot: SegmentSnapshotGetter,
  setSegments: SegmentListSetter,
): SegmentDto[] {
  return publishSegmentStructureMutation(getCurrentSegmentsSnapshot, setSegments, []);
}

/** 转写失败回滚：恢复语段。 */
export function publishTranscribeSegmentRestore(
  getCurrentSegmentsSnapshot: SegmentSnapshotGetter,
  setSegments: SegmentListSetter,
  next: SegmentDto[],
): SegmentDto[] {
  return publishSegmentTextBulkMutation(getCurrentSegmentsSnapshot, setSegments, next);
}

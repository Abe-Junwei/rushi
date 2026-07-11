import type { Extension } from "@codemirror/state";
import { transcriptSelectionDecorations } from "./selectionDecorations";
import {
  transcriptPanelHighlightField,
  transcriptPanelHighlightTheme,
} from "./panelHighlightField";
import {
  transcriptFilterVisibilityField,
  transcriptFilterVisibilityTheme,
} from "./filterLineVisibility";
import { createTranscriptProjectionPublisher } from "./transcriptProjection";
import {
  createTransactionPersistenceBridge,
  type TransactionPersistenceBridgeHandlers,
} from "./transactionPersistenceBridge";
import {
  transcriptMetaGutterExtensions,
  type TranscriptMetaGutterOptions,
} from "./metaGutter";
import {
  transcriptStageGutterExtensions,
  type TranscriptStageGutterOptions,
} from "./stageGutter";
import { transcriptHoverExtensions } from "./hoverSegmentField";
import { transcriptPlaybackFocusExtensions } from "./playbackFocusField";

export type TranscriptEditorCoreExtensionsOptions = {
  persistence?: TransactionPersistenceBridgeHandlers;
  /** Include unidirectional projection publisher (default true). */
  withProjection?: boolean;
  /** Include product meta gutter (default true). */
  withMetaGutter?: boolean;
  /** Include trailing stage gutter (default true when meta gutter on). */
  withStageGutter?: boolean;
  metaGutter?: TranscriptMetaGutterOptions;
  stageGutter?: TranscriptStageGutterOptions;
};

/**
 * CM6 extensions for selection SoT + optional persistence/projection/meta bridges.
 * Flag-on editor mounts should use this bundle.
 */
export function transcriptEditorCoreExtensions(
  opts: TranscriptEditorCoreExtensionsOptions = {},
): Extension[] {
  const withProjection = opts.withProjection !== false;
  const withMetaGutter = opts.withMetaGutter !== false;
  const withStageGutter = opts.withStageGutter !== false && withMetaGutter;
  const selectBridge = opts.metaGutter?.onSelectSegment ?? opts.stageGutter?.onSelectSegment;
  return [
    // multi-selection field is installed by buildTranscriptEditorState
    transcriptSelectionDecorations,
    ...transcriptHoverExtensions,
    ...transcriptPlaybackFocusExtensions,
    transcriptPanelHighlightField,
    transcriptPanelHighlightTheme,
    transcriptFilterVisibilityField,
    transcriptFilterVisibilityTheme,
    ...(withMetaGutter
      ? transcriptMetaGutterExtensions({
          onSelectSegment: selectBridge,
          ...opts.metaGutter,
        })
      : []),
    ...(withStageGutter
      ? transcriptStageGutterExtensions({
          onSelectSegment: selectBridge,
          ...opts.stageGutter,
        })
      : []),
    ...(withProjection ? [createTranscriptProjectionPublisher()] : []),
    ...(opts.persistence ? [createTransactionPersistenceBridge(opts.persistence)] : []),
  ];
}

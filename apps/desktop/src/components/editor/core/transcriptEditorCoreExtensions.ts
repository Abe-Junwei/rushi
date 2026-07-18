import type { MutableRefObject } from "react";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { readTauriStyleCspNonce } from "../../../utils/tauriStyleCspNonce";
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
import {
  createTranscriptRowHeightResizeExtensions,
  type TranscriptRowHeightDragFromDom,
} from "./segmentRowHeightResizeDecorations";
import {
  createTranscriptSegmentTransportOverlayExtensions,
  type TranscriptSegmentTransportHandlers,
} from "./segmentTransportOverlayDecorations";
import { transcriptPlaybackFocusExtensions } from "./playbackFocusField";
import { transcriptScopedPlayingExtensions } from "./scopedPlayingField";
import { transcriptSegmentLoopExtensions } from "./segmentLoopField";
import { transcriptClipboardFilters } from "./transcriptClipboard";
import {
  transcriptFrozenLineDecorations,
  transcriptFrozenLineTheme,
} from "./frozenLineDecorations";

/**
 * Production CSP (`style-src 'self'` + Tauri nonce) blocks CodeMirror's
 * nonce-less `<style>` tags. Without this facet, Release/DMG shows gutters as
 * plain concatenated text and hides line layout (works in Vite-dev where CSP
 * differs). See `EditorView.cspNonce` + style-mod `StyleModule.mount(..., {nonce})`.
 */
export function transcriptEditorCspNonceExtension(
  readNonce: () => string | undefined = readTauriStyleCspNonce,
): Extension[] {
  const nonce = readNonce()?.trim();
  return nonce ? [EditorView.cspNonce.of(nonce)] : [];
}

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
  rowHeightDragFromDomRef?: MutableRefObject<TranscriptRowHeightDragFromDom | undefined>;
  segmentTransportHandlersRef?: MutableRefObject<TranscriptSegmentTransportHandlers>;
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
    // Must precede themes: StyleModule.mount reads facet at EditorView construction.
    ...transcriptEditorCspNonceExtension(),
    // multi-selection field is installed by buildTranscriptEditorState
    transcriptSelectionDecorations,
    transcriptFrozenLineDecorations,
    transcriptFrozenLineTheme,
    ...transcriptClipboardFilters,
    ...transcriptHoverExtensions,
    ...(opts.rowHeightDragFromDomRef
      ? createTranscriptRowHeightResizeExtensions(opts.rowHeightDragFromDomRef)
      : []),
    ...(opts.segmentTransportHandlersRef
      ? createTranscriptSegmentTransportOverlayExtensions(opts.segmentTransportHandlersRef)
      : []),
    ...transcriptPlaybackFocusExtensions,
    ...transcriptScopedPlayingExtensions,
    ...transcriptSegmentLoopExtensions,
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

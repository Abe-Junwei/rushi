export {
  buildSpikeEditorState,
  serializeSpikeEditorState,
} from "./buildSpikeEditorState";
export { mountSpikeEditor, spikeSelectSegmentLine } from "./createSpikeEditor";
export {
  auditSegmentNewlines,
  encodeNewlinesForSingleLineDoc,
  decodeNewlinesFromSingleLineDoc,
  SPIKE_NEWLINE_ESCAPE,
} from "./auditSegmentNewlines";
export type { SpikeSegmentMeta } from "./segmentMeta";

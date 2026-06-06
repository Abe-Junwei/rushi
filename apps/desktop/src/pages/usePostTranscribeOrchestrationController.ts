import type { SegmentDto } from "../tauri/projectApi";
import type { BusyReason } from "./useProjectCrudController";
import { useCorrectionRulesController } from "./useCorrectionRulesController";
import { usePostTranscribeStageBController } from "./usePostTranscribeStageBController";

type Args = {
  busy: boolean;
  transcribePreviewActive?: boolean;
  currentFileId: string | null;
  segments: SegmentDto[];
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  pushUndo: () => void;
  setError: (msg: string) => void;
  saveSegments: (options?: {
    quiet?: boolean;
    countHits?: boolean;
  }) => Promise<boolean>;
  transcribeWarnings: string[];
  llmRuntimeEpoch?: number;
  llmEnvRevision?: string;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
};

/** 转写后编排：阶段 A（规则纠错）与阶段 B（智能改稿）并列，均由工具栏手动触发。 */
export function usePostTranscribeOrchestrationController(args: Args) {
  const stageB = usePostTranscribeStageBController({
    busy: args.busy,
    transcribePreviewActive: args.transcribePreviewActive,
    currentFileId: args.currentFileId,
    segments: args.segments,
    segmentsRef: args.segmentsRef,
    flushSegmentTextDrafts: args.flushSegmentTextDrafts,
    setSegments: args.setSegments,
    setSelectedIdx: args.setSelectedIdx,
    pushUndo: args.pushUndo,
    setError: args.setError,
    saveSegments: (opts) => args.saveSegments(opts),
    llmRuntimeEpoch: args.llmRuntimeEpoch,
    llmEnvRevision: args.llmEnvRevision,
    beginBusy: args.beginBusy,
    endBusy: args.endBusy,
  });

  const correctionRules = useCorrectionRulesController({
    busy: args.busy,
    currentFileId: args.currentFileId,
    segments: args.segments,
    segmentsRef: args.segmentsRef,
    flushSegmentTextDrafts: args.flushSegmentTextDrafts,
    setSegments: args.setSegments,
    pushUndo: args.pushUndo,
    setError: args.setError,
    saveSegments: args.saveSegments,
    transcribeWarnings: args.transcribeWarnings,
  });

  return {
    ...correctionRules,
    ...stageB,
  };
}

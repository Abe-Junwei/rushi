import type { MutableRefObject } from "react";
import { asrBaseUrl } from "../config/env";
import type { SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { logFirstSegmentsVisibleMs, pollTranscribeJob } from "./transcribeAsyncPoll";
import {
  isTranscribeAsyncUnavailable,
  mergeTranscribeSegmentsDelta,
  parseTranscribeProgress,
  TranscribeUserCancelledError,
  type TranscribeProgress,
  type TranscribeStatusPayload,
} from "./transcribePreviewState";

export type LocalTranscribeJobRunRefs = {
  activeJobId: { current: string | null };
  userCancelRequested: { current: boolean };
  transcribeStartedAtMs: { current: number };
  firstSegmentsLogged: { current: boolean };
};

export type LocalTranscribeJobRunCallbacks = {
  setSegments: (segments: SegmentDto[]) => void;
  setTranscribeProgress: (progress: TranscribeProgress | null) => void;
};

export type LocalTranscribeJobRunArgs = {
  fileId: string;
  base: string;
  segmentsRef: MutableRefObject<SegmentDto[]>;
  refs: LocalTranscribeJobRunRefs;
  callbacks: LocalTranscribeJobRunCallbacks;
};

function onTranscribeStatusTick(
  st: TranscribeStatusPayload,
  segmentsRef: MutableRefObject<SegmentDto[]>,
  refs: LocalTranscribeJobRunRefs,
  callbacks: LocalTranscribeJobRunCallbacks,
): void {
  if (st.segments_delta?.length && !refs.firstSegmentsLogged.current) {
    refs.firstSegmentsLogged.current = true;
    logFirstSegmentsVisibleMs(Date.now() - refs.transcribeStartedAtMs.current);
  }
  if (st.segments_delta?.length) {
    const merged = mergeTranscribeSegmentsDelta(segmentsRef.current, st.segments_delta);
    segmentsRef.current = merged;
    callbacks.setSegments(merged);
  }
  callbacks.setTranscribeProgress(parseTranscribeProgress(st));
}

export async function runLocalTranscribeJob(
  args: LocalTranscribeJobRunArgs,
): Promise<{ out: p1.RunTranscribeOutcome; usedAsyncFallback: boolean }> {
  const { fileId, base, segmentsRef, refs, callbacks } = args;
  try {
    const { jobId } = await p1.projectTranscribeAsyncStart(fileId, asrBaseUrl());
    refs.activeJobId.current = jobId;
    await pollTranscribeJob(
      jobId,
      base,
      (st) => onTranscribeStatusTick(st, segmentsRef, refs, callbacks),
      () => refs.userCancelRequested.current,
    );
    if (refs.userCancelRequested.current) {
      throw new TranscribeUserCancelledError();
    }
    const out = await p1.projectTranscribeAsyncFinalize(fileId, jobId, asrBaseUrl());
    return { out, usedAsyncFallback: false };
  } catch (e) {
    if (!isTranscribeAsyncUnavailable(e)) throw e;
    const out = await p1.projectRunTranscribe(fileId, asrBaseUrl(), null);
    return { out, usedAsyncFallback: true };
  } finally {
    refs.activeJobId.current = null;
  }
}

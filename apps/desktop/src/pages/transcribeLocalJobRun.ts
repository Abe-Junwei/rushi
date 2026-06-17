import { asrBaseUrl } from "../config/env";
import type { SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { materializeSegmentTextDrafts } from "../hooks/useSegmentDraftStore";
import { logFirstSegmentsVisibleMs, pollTranscribeJob, postTranscribeCancel } from "./transcribeAsyncPoll";
import type { SegmentPublishApi } from "./segmentPublishApi";
import {
  isTranscribeAsyncUnavailable,
  mergeTranscribeSegmentsDelta,
  parseTranscribeProgress,
  TRANSCRIBE_PENDING_JOB_ID,
  TranscribeUserCancelledError,
  type TranscribeProgress,
  type TranscribeStatusPayload,
} from "./transcribePreviewState";

type LocalTranscribeJobRunRefs = {
  activeJobId: { current: string | null };
  userCancelRequested: { current: boolean };
  transcribeStartedAtMs: { current: number };
  firstSegmentsLogged: { current: boolean };
  pollAbort: { current: AbortController | null };
};

type LocalTranscribeJobRunCallbacks = {
  setTranscribeProgress: (progress: TranscribeProgress | null) => void;
};

export type LocalTranscribeJobRunArgs = {
  fileId: string;
  base: string;
  segmentPublish: SegmentPublishApi;
  refs: LocalTranscribeJobRunRefs;
  callbacks: LocalTranscribeJobRunCallbacks;
};

function onTranscribeStatusTick(
  st: TranscribeStatusPayload,
  segmentPublish: SegmentPublishApi,
  refs: LocalTranscribeJobRunRefs,
  callbacks: LocalTranscribeJobRunCallbacks,
): void {
  if (st.segments_delta?.length && !refs.firstSegmentsLogged.current) {
    refs.firstSegmentsLogged.current = true;
    logFirstSegmentsVisibleMs(Date.now() - refs.transcribeStartedAtMs.current);
  }
  if (st.segments_delta?.length) {
    const base = materializeSegmentTextDrafts(segmentPublish.getCurrentSegmentsSnapshot());
    const merged = mergeTranscribeSegmentsDelta(base, st.segments_delta);
    segmentPublish.publishStructure(merged);
  }
  const progress = parseTranscribeProgress(st);
  callbacks.setTranscribeProgress(progress);
  const jobId = refs.activeJobId.current;
  if (jobId && jobId !== TRANSCRIBE_PENDING_JOB_ID) {
    void p1
      .recordTranscribeTimelinePollProgress(
        jobId,
        progress?.windowIndex ?? 0,
        progress?.windowCount ?? 0,
      )
      .catch(() => null);
  }
}

function throwIfUserCancelled(refs: LocalTranscribeJobRunRefs): void {
  if (refs.userCancelRequested.current) {
    throw new TranscribeUserCancelledError();
  }
}

async function bestEffortCancelSidecarJob(base: string, jobId: string): Promise<void> {
  try {
    await postTranscribeCancel(base, jobId);
  } catch {
    /* poll loop will surface sidecar errors or timeout */
  }
}

async function persistPollFailureTimeline(
  refs: LocalTranscribeJobRunRefs,
  error: unknown,
): Promise<void> {
  const jobId = refs.activeJobId.current;
  if (!jobId || jobId === TRANSCRIBE_PENDING_JOB_ID || error instanceof TranscribeUserCancelledError) {
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  await p1.recordTranscribeTimelinePollFailure(jobId, message).catch(() => null);
}

export async function runLocalTranscribeJob(
  args: LocalTranscribeJobRunArgs,
): Promise<{ out: p1.RunTranscribeOutcome; usedAsyncFallback: boolean }> {
  const { fileId, base, segmentPublish, refs, callbacks } = args;
  refs.activeJobId.current = TRANSCRIBE_PENDING_JOB_ID;
  try {
    throwIfUserCancelled(refs);
    const { jobId } = await p1.projectTranscribeAsyncStart(fileId, asrBaseUrl());
    refs.activeJobId.current = jobId;
    if (refs.userCancelRequested.current) {
      await bestEffortCancelSidecarJob(base, jobId);
      throw new TranscribeUserCancelledError();
    }
    await pollTranscribeJob(
      jobId,
      base,
      (st) => onTranscribeStatusTick(st, segmentPublish, refs, callbacks),
      () => refs.userCancelRequested.current,
      { signal: refs.pollAbort.current?.signal },
    );
    const out = await p1.projectTranscribeAsyncFinalize(fileId, jobId, asrBaseUrl());
    return { out, usedAsyncFallback: false };
  } catch (e) {
    if (!isTranscribeAsyncUnavailable(e)) {
      await persistPollFailureTimeline(refs, e);
      throw e;
    }
    throwIfUserCancelled(refs);
    const out = await p1.projectRunTranscribe(fileId, asrBaseUrl(), null);
    return { out, usedAsyncFallback: true };
  } finally {
    refs.activeJobId.current = null;
  }
}

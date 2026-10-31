import "./transcribeJobController.testSetup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  baseTranscribeJobDeps,
  loopbackFetch,
  resetTranscribeJobControllerTests,
  transcribeJobTestApi,
  TRANSCRIBE_TEST_ASR_BASE,
} from "./transcribeJobController.testHelpers";
import { runLocalTranscribeJob } from "./transcribeLocalJobRun";

const api = transcribeJobTestApi();

describe("local transcribe audit repros (expected failures, not acceptance)", () => {
  beforeEach(resetTranscribeJobControllerTests);

  it.each(["HTTP 503", "request timeout"])(
    "AUD-03 cancels the accepted sidecar job before forgetting it after %s",
    async (failure) => {
      vi.mocked(loopbackFetch).mockImplementation((_url, init) => {
        if (init?.method === "POST") {
          return Promise.resolve(new Response(JSON.stringify({ cancelled: true })));
        }
        if (failure === "request timeout") return Promise.reject(new Error("request timeout"));
        return Promise.resolve(new Response("unavailable", { status: 503 }));
      });
      const refs = {
        activeJobId: { current: null as string | null },
        userCancelRequested: { current: false },
        transcribeStartedAtMs: { current: Date.now() },
        firstSegmentsLogged: { current: false },
        pollAbort: { current: new AbortController() },
        appliedSegmentCount: { current: 0 },
      };
      await expect(
        runLocalTranscribeJob({
          fileId: "file-1",
          base: TRANSCRIBE_TEST_ASR_BASE,
          segmentPublish: baseTranscribeJobDeps().segmentPublish,
          refs,
          callbacks: { setTranscribeProgress: vi.fn() },
        }),
      ).rejects.toThrow();
      expect(api.projectTranscribeAsyncStart).toHaveBeenCalledOnce();
      expect(api.recordTranscribeTimelinePollFailure).toHaveBeenCalledWith("job-1", expect.any(String));
      expect(api.projectTranscribeAsyncFinalize).not.toHaveBeenCalled();
      expect(refs.activeJobId.current).toBeNull();
      expect(loopbackFetch).toHaveBeenCalledWith(
        `${TRANSCRIBE_TEST_ASR_BASE}/v1/transcribe/cancel`,
        expect.objectContaining({ method: "POST", body: JSON.stringify({ job_id: "job-1" }) }),
      );
    },
  );
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { pollTranscribeJob, postTranscribeCancel } from "./transcribeAsyncPoll";
import { TranscribeUserCancelledError } from "./transcribePreviewState";

vi.mock("../services/asr/loopbackFetch", () => ({
  loopbackFetch: vi.fn(),
}));

import { loopbackFetch } from "../services/asr/loopbackFetch";

describe("transcribeAsyncPoll", () => {
  beforeEach(() => {
    vi.mocked(loopbackFetch).mockReset();
  });

  it("postTranscribeCancel posts job_id", async () => {
    vi.mocked(loopbackFetch).mockResolvedValue(new Response("{}", { status: 200 }));
    await postTranscribeCancel("http://127.0.0.1:8741", "job-1");
    expect(loopbackFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8741/v1/transcribe/cancel",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ job_id: "job-1" }),
      }),
    );
  });

  it("pollTranscribeJob resolves on done", async () => {
    vi.mocked(loopbackFetch).mockResolvedValue(
      new Response(JSON.stringify({ phase: "done" }), { status: 200 }),
    );
    const ticks: string[] = [];
    await pollTranscribeJob("job-1", "http://127.0.0.1:8741", (st) => {
      ticks.push(st.phase);
    }, () => false);
    expect(ticks).toEqual(["done"]);
  });

  it("pollTranscribeJob throws when shouldStop before done", async () => {
    let pollCount = 0;
    vi.mocked(loopbackFetch).mockImplementation(() => {
      pollCount += 1;
      return Promise.resolve(
        new Response(
          JSON.stringify({ phase: "transcribing", window_index: 1, window_count: 3 }),
          { status: 200 },
        ),
      );
    });
    let stop = false;
    const poll = pollTranscribeJob(
      "job-1",
      "http://127.0.0.1:8741",
      () => {},
      () => stop,
    );
    stop = true;
    await expect(poll).rejects.toBeInstanceOf(TranscribeUserCancelledError);
    expect(pollCount).toBeGreaterThanOrEqual(1);
  });

  it("pollTranscribeJob throws on cancelled phase", async () => {
    vi.mocked(loopbackFetch).mockResolvedValue(
      new Response(JSON.stringify({ phase: "cancelled" }), { status: 200 }),
    );
    await expect(
      pollTranscribeJob("job-1", "http://127.0.0.1:8741", () => {}, () => false),
    ).rejects.toBeInstanceOf(TranscribeUserCancelledError);
  });
});

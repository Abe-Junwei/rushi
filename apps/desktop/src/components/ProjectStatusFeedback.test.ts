import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { BusyReason } from "../pages/useProjectController";
import { TranscribeDiagBanner } from "./ProjectStatusFeedback";
import { busyOverlayCopy } from "./projectStatusFeedbackCopy";

describe("ProjectBusyOverlay transcribe copy (R3t-B)", () => {
  it("shows transcribe-specific title and hint", () => {
    const copy = busyOverlayCopy("transcribe", null);
    expect(copy.title).toContain("自动转录");
    expect(copy.hint).toMatch(/分段处理|语段/);
  });

  it("shows save-specific copy", () => {
    const copy = busyOverlayCopy("save" satisfies BusyReason, null);
    expect(copy.title).toContain("SQLite");
  });
});

describe("TranscribeDiagBanner (TRN-DIAG)", () => {
  it("shows transcribe stage label when sidecar fails during transcribe", () => {
    render(
      createElement(TranscribeDiagBanner, {
        diag: {
          schemaVersion: 1,
          fileId: "file-1",
          source: "local",
          startedAtMs: 1,
          outcome: "failed",
          failedStage: "transcribe",
          errorCode: "sidecar_connect",
          errorMessage: "无法连接本机 ASR（127.0.0.1:8741 拒绝连接）",
          suggestedAction: "侧车可能未启动或已崩溃；请到「环境 → 本机 ASR」重试内置侧车。",
          transcribeTimeline: [
            { stage: "preflight", startedAtMs: 1, endedAtMs: 2 },
            {
              stage: "transcribe",
              startedAtMs: 3,
              endedAtMs: 4,
              errorCode: "sidecar_connect",
            },
          ],
        },
        errorMessage: "无法连接本机 ASR",
      }),
    );
    expect(screen.getByText(/转写失败（转写）/)).toBeTruthy();
    expect(screen.getByText(/sidecar_connect/)).toBeTruthy();
    expect(screen.queryByText(/未知阶段/)).toBeNull();
  });
});

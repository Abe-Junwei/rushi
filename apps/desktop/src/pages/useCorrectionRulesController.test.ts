import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { correctionMemoryList, correctionStableRulesList } from "../tauri/correctionApi";
import type { SegmentDto } from "../tauri/projectApi";
import { useCorrectionRulesController } from "./useCorrectionRulesController";

vi.mock("../tauri/correctionApi", () => ({
  correctionStableRulesList: vi.fn(),
  correctionMemoryList: vi.fn(),
}));

function baseArgs() {
  const segments: SegmentDto[] = [{ uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "智控系统" }];
  const segmentsRef = { current: segments };
  return {
    busy: false,
    currentFileId: "file-1",
    segments,
    segmentsRef,
    flushSegmentTextDrafts: vi.fn(),
    setSegments: vi.fn(),
    pushUndo: vi.fn(),
    setError: vi.fn(),
    saveSegments: vi.fn().mockResolvedValue(true),
  };
}

describe("useCorrectionRulesController F0 stage A", () => {
  beforeEach(() => {
    vi.mocked(correctionStableRulesList).mockReset();
    vi.mocked(correctionMemoryList).mockReset();
    vi.mocked(correctionMemoryList).mockResolvedValue([]);
  });

  it("openPostTranscribeStageA shows preview when rules match", async () => {
    vi.mocked(correctionStableRulesList).mockResolvedValue([
      { wrong: "智控", right: "制控", hitCount: 3, acceptedAsRule: false },
    ]);
    const args = baseArgs();
    const { result } = renderHook(() => useCorrectionRulesController(args));

    await act(async () => {
      await result.current.openPostTranscribeStageA();
    });

    expect(result.current.correctionRulesDialog.phase).toBe("preview");
    if (result.current.correctionRulesDialog.phase === "preview") {
      expect(result.current.correctionRulesDialog.trigger).toBe("postTranscribe");
      expect(result.current.correctionRulesDialog.changes.length).toBeGreaterThan(0);
    }
  });

  it("openPostTranscribeStageA shows preview for hygiene-only when no rules match", async () => {
    vi.mocked(correctionStableRulesList).mockResolvedValue([]);
    const segments: SegmentDto[] = [
      { uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "你好。。。" },
    ];
    const args = { ...baseArgs(), segments, segmentsRef: { current: segments } };
    const { result } = renderHook(() => useCorrectionRulesController(args));

    await act(async () => {
      await result.current.openPostTranscribeStageA();
    });

    expect(result.current.correctionRulesDialog.phase).toBe("preview");
    if (result.current.correctionRulesDialog.phase === "preview") {
      expect(result.current.correctionRulesDialog.changes[0]?.afterText).toBe("你好。");
      expect(result.current.correctionRulesDialog.hygieneTouchedCount).toBe(1);
    }
  });

  it("openPostTranscribeStageA shows empty dialog when no segment matches", async () => {
    vi.mocked(correctionStableRulesList).mockResolvedValue([
      { wrong: "不存在", right: "正形", hitCount: 3, acceptedAsRule: false },
    ]);
    const args = baseArgs();
    const { result } = renderHook(() => useCorrectionRulesController(args));

    await act(async () => {
      await result.current.openPostTranscribeStageA();
    });

    expect(result.current.correctionRulesDialog).toMatchObject({
      phase: "empty",
      readOnlyTranscribeHints: [],
      readOnlyLearningHints: [],
      trigger: "postTranscribe",
    });
    if (result.current.correctionRulesDialog.phase === "empty") {
      expect(result.current.correctionRulesDialog.lexiconHealth.stableRuleCount).toBe(1);
    }
  });

  it("blocks confirm when stable rules conflict", async () => {
    vi.mocked(correctionStableRulesList).mockResolvedValue([
      { wrong: "智控", right: "制控", hitCount: 3, acceptedAsRule: false },
      { wrong: "智控", right: "自控", hitCount: 4, acceptedAsRule: false },
    ]);
    const args = baseArgs();
    const { result } = renderHook(() => useCorrectionRulesController(args));

    await act(async () => {
      await result.current.openPostTranscribeStageA();
    });

    expect(result.current.correctionRulesStableConflictMessage).toContain("智控");
    await act(async () => {
      await result.current.confirmCorrectionRulesWriteback();
    });
    expect(args.saveSegments).not.toHaveBeenCalled();
  });

  it("shows read-only hints not duplicated by stable rules", async () => {
    vi.mocked(correctionStableRulesList).mockResolvedValue([
      { wrong: "智控", right: "制控", hitCount: 3, acceptedAsRule: false },
    ]);
    const args = {
      ...baseArgs(),
      transcribeWarnings: ["correction_rule_hint:智控->制控", "correction_rule_hint:其它->正形"],
    };
    const { result } = renderHook(() => useCorrectionRulesController(args));

    await act(async () => {
      await result.current.openPostTranscribeStageA();
    });

    if (result.current.correctionRulesDialog.phase === "preview") {
      expect(result.current.correctionRulesDialog.readOnlyTranscribeHints).toEqual([
        { beforeText: "其它", afterText: "正形" },
      ]);
    }
  });

  it("shows read-only learning hints when hit=1 and segment matches", async () => {
    vi.mocked(correctionStableRulesList).mockResolvedValue([]);
    vi.mocked(correctionMemoryList).mockResolvedValue([
      {
        wrong: "智控",
        right: "制控",
        hitCount: 1,
        acceptedAsRule: false,
        updatedAtMs: 0,
        isStable: false,
      },
    ]);
    const args = baseArgs();
    const { result } = renderHook(() => useCorrectionRulesController(args));

    await act(async () => {
      await result.current.openCorrectionRulesManual();
    });

    expect(result.current.correctionRulesDialog.phase).toBe("empty");
    if (result.current.correctionRulesDialog.phase === "empty") {
      expect(result.current.correctionRulesDialog.readOnlyLearningHints).toEqual([
        { beforeText: "智控", afterText: "制控", hitCount: 1 },
      ]);
    }
  });

  it("confirm writeback applies only selected segments", async () => {
    vi.mocked(correctionStableRulesList).mockResolvedValue([
      { wrong: "智控", right: "制控", hitCount: 3, acceptedAsRule: false },
      { wrong: "系统", right: "体系", hitCount: 3, acceptedAsRule: false },
    ]);
    const segments: SegmentDto[] = [
      { uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "智控A" },
      { uid: "s2", idx: 1, start_sec: 1, end_sec: 2, text: "智控系统" },
    ];
    const segmentsRef = { current: segments };
    const setSegments = vi.fn((updater: SegmentDto[] | ((prev: SegmentDto[]) => SegmentDto[])) => {
      const next = typeof updater === "function" ? updater(segmentsRef.current) : updater;
      segmentsRef.current = next;
    });
    const args = {
      ...baseArgs(),
      segments,
      segmentsRef,
      setSegments,
    };
    const { result } = renderHook(() => useCorrectionRulesController(args));

    await act(async () => {
      await result.current.openPostTranscribeStageA();
    });
    expect(result.current.correctionRulesDialog.phase).toBe("preview");
    if (result.current.correctionRulesDialog.phase !== "preview") return;

    act(() => {
      result.current.toggleCorrectionRulesSegment(0);
    });

    await act(async () => {
      await result.current.confirmCorrectionRulesWriteback();
    });

    expect(segmentsRef.current[0]?.text).toBe("智控A");
    expect(segmentsRef.current[1]?.text).not.toBe("智控系统");
  });

  it("does not auto-open on missing file", async () => {
    const args = { ...baseArgs(), currentFileId: null };
    const { result } = renderHook(() => useCorrectionRulesController(args));

    await act(async () => {
      await result.current.openPostTranscribeStageA();
    });

    expect(result.current.correctionRulesDialog.phase).toBe("closed");
  });
});

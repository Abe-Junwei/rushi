import { useCallback, useState } from "react";
import { asrBaseUrl } from "../config/env";
import { deriveTranscribeHints } from "../services/asrTranscribeHints";
import {
  isSttOnlineEnabledButIncomplete,
  tryBuildOnlineTranscribeBridgePayload,
} from "../services/stt/sttOnlineProviderContract";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import type { useProjectCloseGateController } from "./useProjectCloseGateController";
import type { useProjectEditorState } from "./useProjectEditorState";
import type { useProjectBusyState } from "./useProjectBusyState";
import type { useSegmentMutationController } from "./useSegmentMutationController";
import { segmentsHaveNonEmptyText } from "./transcribeJobHelpers";

export type LocalTranscribePreflight = () => string | null;

type CloseGate = Pick<
  ReturnType<typeof useProjectCloseGateController>,
  "openFileWrapped"
>;
type Editor = Pick<
  ReturnType<typeof useProjectEditorState>,
  "current" | "currentFileId" | "segments" | "segmentsRef" | "setCurrent"
>;
type Busy = Pick<ReturnType<typeof useProjectBusyState>, "busy" | "beginBusy" | "endBusy">;
type Mutations = Pick<ReturnType<typeof useSegmentMutationController>, "resetMutationHistory">;

type Deps = {
  busy: Busy["busy"];
  beginBusy: Busy["beginBusy"];
  endBusy: Busy["endBusy"];
  current: Editor["current"];
  currentFileId: Editor["currentFileId"];
  segments: Editor["segments"];
  segmentsRef: Editor["segmentsRef"];
  setCurrent: Editor["setCurrent"];
  setError: (msg: string) => void;
  closeGate: CloseGate;
  mutations: Mutations;
  localTranscribePreflight: LocalTranscribePreflight;
};

export function useTranscribeJobController(deps: Deps) {
  const {
    busy,
    beginBusy,
    endBusy,
    current,
    currentFileId,
    segments,
    segmentsRef,
    setCurrent,
    setError,
    closeGate,
    mutations,
    localTranscribePreflight,
  } = deps;

  const [transcribeHints, setTranscribeHints] = useState<string[]>([]);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);

  const executeTranscribe = useCallback(async () => {
    if (busy || !current || !currentFileId) {
      if (!busy && current && !currentFileId) {
        setError("请先打开一个文件后再拉取语段");
      }
      return;
    }
    if (isSttOnlineEnabledButIncomplete()) {
      setError(
        "已启用在线 STT：请在「环境与 ASR」中选择厂商、填写 API Key 并点击保存在线配置；自建网关还须填写 HTTPS 转写 URL。OpenAI / AssemblyAI 可留空 URL 使用默认端点。",
      );
      return;
    }
    if (!tryBuildOnlineTranscribeBridgePayload()) {
      const block = localTranscribePreflight();
      if (block) {
        setError(block);
        return;
      }
    }
    const fileId = currentFileId;
    setOverwriteDialogOpen(false);
    beginBusy("transcribe");
    setError("");
    setTranscribeHints([]);
    try {
      const online = tryBuildOnlineTranscribeBridgePayload();
      const out = await p1.projectRunTranscribe(fileId, asrBaseUrl(), online ?? null);
      mutations.resetMutationHistory();
      const projectDetail = await p1.projectLoad(current.id);
      setCurrent(projectDetail);
      await closeGate.openFileWrapped(fileId);
      const hints = deriveTranscribeHints(out.engine, out.warnings, out.detail.segments);
      if (import.meta.env.DEV && hints.length > 0) {
        hints.push("（开发模式）详见仓库 services/asr/README.md。");
      }
      setTranscribeHints(hints);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [
    busy,
    current,
    currentFileId,
    mutations,
    closeGate,
    beginBusy,
    endBusy,
    setCurrent,
    setError,
    localTranscribePreflight,
  ]);

  const requestTranscribe = useCallback(async () => {
    if (busy || !current || !currentFileId) {
      if (!busy && current && !currentFileId) {
        setError("请先打开一个文件后再拉取语段");
      }
      return;
    }
    if (segmentsHaveNonEmptyText(segmentsRef.current)) {
      setOverwriteDialogOpen(true);
      return;
    }
    await executeTranscribe();
  }, [busy, current, currentFileId, segmentsRef, setError, executeTranscribe]);

  const cancelTranscribeOverwrite = useCallback(() => {
    if (busy) return;
    setOverwriteDialogOpen(false);
  }, [busy]);

  const confirmTranscribeOverwrite = useCallback(() => {
    void executeTranscribe();
  }, [executeTranscribe]);

  const applyDetail = useCallback(
    (_d: ProjectDetail) => {
      setTranscribeHints([]);
      setOverwriteDialogOpen(false);
    },
    [],
  );

  return {
    transcribeHints,
    setTranscribeHints,
    overwriteDialogOpen,
    overwriteSegmentCount: segments.length,
    requestTranscribe,
    cancelTranscribeOverwrite,
    confirmTranscribeOverwrite,
    applyDetailClearTranscribe: applyDetail,
  };
}

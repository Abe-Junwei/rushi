import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatTranscribeVocabularyPreflightLines,
  loadTranscribeVocabularyPreflight,
} from "../services/asr/transcribeVocabularyPreflight";
import {
  isOnlineTranscribeReady,
} from "../services/stt/sttOnlineProviderContract";
import { STT_ONLINE_RUNTIME_CHANGED_EVENT } from "../services/stt/sttOnlineRuntimeNotify";
import {
  clearTranscribeSourceUserOverride,
  persistTranscribeSource,
  persistTranscribeSourceUserOverride,
  readStoredTranscribeSource,
  readTranscribeSourceUserOverride,
  type TranscribeSource,
} from "../services/stt/transcribeSource";

type Args = {
  busy: boolean;
  current: { id: string } | null;
  currentFileId: string | null;
  setError: (msg: string) => void;
  sttOnlineRuntimeEpoch?: number;
  onConfirmStart: () => Promise<void>;
};

export function useTranscribeJobPreflight(args: Args) {
  const {
    busy,
    current,
    currentFileId,
    setError,
    sttOnlineRuntimeEpoch = 0,
    onConfirmStart,
  } = args;

  const [transcribeVocabularyPreflightLines, setTranscribeVocabularyPreflightLines] = useState<
    string[]
  >([]);
  const [transcribeStartDialogOpen, setTranscribeStartDialogOpen] = useState(false);
  const [transcribeSource, setTranscribeSourceState] = useState<TranscribeSource>(readStoredTranscribeSource);
  const [sttRuntimeRevision, setSttRuntimeRevision] = useState(0);

  useEffect(() => {
    const bump = () => setSttRuntimeRevision((n) => n + 1);
    window.addEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, bump);
    return () => window.removeEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, bump);
  }, []);

  const refreshVocabularyPreflight = useCallback(async () => {
    try {
      const summary = await loadTranscribeVocabularyPreflight(transcribeSource);
      setTranscribeVocabularyPreflightLines(formatTranscribeVocabularyPreflightLines(summary));
    } catch {
      setTranscribeVocabularyPreflightLines([]);
    }
  }, [transcribeSource]);

  useEffect(() => {
    if (!currentFileId) {
      setTranscribeVocabularyPreflightLines([]);
      return;
    }
    void refreshVocabularyPreflight();
  }, [currentFileId, sttOnlineRuntimeEpoch, sttRuntimeRevision, transcribeSource, refreshVocabularyPreflight]);

  const onlineTranscribeReady = useMemo(() => {
    void sttOnlineRuntimeEpoch;
    void sttRuntimeRevision;
    return isOnlineTranscribeReady();
  }, [sttOnlineRuntimeEpoch, sttRuntimeRevision]);

  useEffect(() => {
    if (transcribeSource === "online" && !onlineTranscribeReady) {
      setTranscribeSourceState("local");
      persistTranscribeSource("local");
      clearTranscribeSourceUserOverride();
    }
  }, [onlineTranscribeReady, transcribeSource]);

  useEffect(() => {
    if (!onlineTranscribeReady) return;
    if (readTranscribeSourceUserOverride() === "local") return;
    if (transcribeSource === "online") return;
    setTranscribeSourceState("online");
    persistTranscribeSource("online");
  }, [onlineTranscribeReady, transcribeSource]);

  const setTranscribeSource = useCallback((source: TranscribeSource) => {
    setTranscribeSourceState(source);
    persistTranscribeSource(source);
    persistTranscribeSourceUserOverride(source);
  }, []);

  const requestTranscribe = useCallback(async () => {
    if (busy) return;
    if (!current || !currentFileId) {
      setError("请先打开一个文件后再自动转录");
      return;
    }
    await refreshVocabularyPreflight();
    setTranscribeStartDialogOpen(true);
  }, [busy, current, currentFileId, refreshVocabularyPreflight, setError]);

  const cancelTranscribeStart = useCallback(() => {
    if (busy) return;
    setTranscribeStartDialogOpen(false);
  }, [busy]);

  const confirmTranscribeStart = useCallback(async () => {
    setTranscribeStartDialogOpen(false);
    await onConfirmStart();
  }, [onConfirmStart]);

  return {
    transcribeVocabularyPreflightLines,
    transcribeStartDialogOpen,
    setTranscribeStartDialogOpen,
    transcribeSource,
    setTranscribeSource,
    onlineTranscribeReady,
    requestTranscribe,
    cancelTranscribeStart,
    confirmTranscribeStart,
  };
}

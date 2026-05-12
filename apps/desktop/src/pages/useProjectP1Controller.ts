import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { asrBaseUrl, asrHealthUrl, isDefaultBundledAsrTarget } from "../config/env";
import { deriveTranscribeHints } from "../services/asrTranscribeHints";
import { formatSrt, formatTxt, type ExportSegment } from "../services/exportFormatters";
import type { AsrHealthCapabilities, ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/p1Api";
import * as p1 from "../tauri/p1Api";
import {
  isSttOnlineEnabledButIncomplete,
  tryBuildP1OnlineTranscribeBridgePayload,
} from "../services/stt/sttOnlineProviderContract";
import { p3ExportDocx, type P3DocxExportMode } from "../tauri/p3ExportDocxApi";
import { p4ExportDiagnosticBundle } from "../tauri/p4DiagnosticApi";
import { describePrepareModelFailure, type PrepareModelFailureCopy } from "./prepareModelDownloadCopy";
import { buildSplitPair, mergeTwoSegments, reindexSegments } from "./p1SegmentListHelpers";

function cloneSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((s) => ({ ...s }));
}

function roundSec3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** 避免默认文件名含路径分隔符等非法字符。 */
function safeExportBasename(name: string, ext: "txt" | "srt" | "docx"): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "export";
  return `${base}.${ext}`;
}

export type AsrHealthState = "checking" | "ok" | "error";

/** 与 `busy` 同时为真；`busy` 为假时为 null。 */
export type P1BusyReason = "create" | "load" | "transcribe" | "save" | "delete" | "install_funasr";

/** 忙状态：`busy` 与 `reason` 原子更新，避免读到不一致组合。 */
type P1BusyPack = { busy: boolean; reason: P1BusyReason | null };

export function parseAsrHealthJson(data: unknown): AsrHealthCapabilities | null {
  if (!data || typeof data !== "object") return null;
  const j = data as Record<string, unknown>;
  if (typeof j.status !== "string" || j.status !== "ok") return null;
  if (j.service !== "rushi-asr") return null;
  const mode = j.transcription_mode === "funasr" ? "funasr" : "stub";
  return {
    ffmpeg_ok: j.ffmpeg_ok === true,
    funasr_import_ok: j.funasr_import_ok === true,
    funasr_model_configured: j.funasr_model_configured === true,
    funasr_model_explicit_from_env: j.funasr_model_explicit_from_env === true,
    funasr_default_model_cached: j.funasr_default_model_cached === true,
    funasr_ready: j.funasr_ready === true,
    transcription_mode: mode,
    funasr_model_id: typeof j.funasr_model_id === "string" ? j.funasr_model_id : null,
    rushi_models_root: typeof j.rushi_models_root === "string" ? j.rushi_models_root : null,
  };
}

/** 无桌面一键安装时，用户可自己在终端执行（路径随仓库）。 */
export function funasrManualSetupCommands(): string {
  return [
    "cd services/asr",
    "source .venv/bin/activate   # Windows: .venv\\\\Scripts\\\\activate",
    'pip install -e ".[funasr]"',
    "# 可选：export RUSHI_FUNASR_MODEL=其他模型   # 不设则使用内置默认 iic/SenseVoiceSmall",
    "python -m rushi_asr",
  ].join("\n");
}

export function useProjectP1Controller() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [current, setCurrent] = useState<ProjectDetail | null>(null);
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [asrHealth, setAsrHealth] = useState<AsrHealthState>("checking");
  const [asrHealthDetail, setAsrHealthDetail] = useState<string>("");
  const [bundledAsrDiag, setBundledAsrDiag] = useState<p1.BundledAsrLaunchReport | null>(null);
  const [asrCaps, setAsrCaps] = useState<AsrHealthCapabilities | null>(null);
  const [funasrInstallMessage, setFunasrInstallMessage] = useState<string>("");
  const [prepareModelBusy, setPrepareModelBusy] = useState(false);
  const [prepareModelProgress, setPrepareModelProgress] = useState(0);
  const [prepareModelFailure, setPrepareModelFailure] = useState<PrepareModelFailureCopy | null>(null);
  const [transcribeHints, setTranscribeHints] = useState<string[]>([]);
  const [busyPack, setBusyPack] = useState<P1BusyPack>({ busy: false, reason: null });
  const busy = busyPack.busy;
  const busyReason = busyPack.reason;
  const beginBusy = useCallback((reason: P1BusyReason) => {
    setBusyPack({ busy: true, reason });
  }, []);
  const endBusy = useCallback(() => {
    setBusyPack({ busy: false, reason: null });
  }, []);
  const [newName, setNewName] = useState("未命名项目");
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const [sttOnlineBridgeEpoch, setSttOnlineBridgeEpoch] = useState(0);
  const sttOnlineBridgeReady = useMemo(
    () => tryBuildP1OnlineTranscribeBridgePayload() !== null,
    [sttOnlineBridgeEpoch],
  );
  const bumpSttOnlineRuntimeChanged = useCallback(() => {
    setSttOnlineBridgeEpoch((n) => n + 1);
  }, []);
  const undoStack = useRef<SegmentDto[][]>([]);
  const redoStack = useRef<SegmentDto[][]>([]);
  const textEditUndoRef = useRef<{ idx: number; atMs: number } | null>(null);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  /** 波形 region 拖拽中：live 已 pushUndo 时，commit 不再重复入栈。 */
  const segmentBoundsLiveGestureRef = useRef(false);
  const prepareModelAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      prepareModelAbortRef.current?.abort();
    };
  }, []);

  /** 将语段卡正文输入框当前值写回 `segments`（与本地 draft 一致），供保存/合并等读最新正文。 */
  const flushP1SegmentTextDraftsFromDom = useCallback(() => {
    const prev = segmentsRef.current;
    const updates: { idx: number; text: string }[] = [];
    prev.forEach((s, i) => {
      const row = document.querySelector(`[data-p1-seg-row="${i}"]`);
      const ta = row?.querySelector<HTMLTextAreaElement | HTMLInputElement>("textarea, input.p1-seg-text");
      if (!ta || ta.value === s.text) return;
      updates.push({ idx: i, text: ta.value });
    });
    if (updates.length === 0) return;
    flushSync(() => {
      setSegments((cur) => {
        let next = cur;
        for (const { idx, text } of updates) {
          if (idx < 0 || idx >= cur.length) continue;
          const seg = cur[idx];
          if (!seg || seg.text === text) continue;
          if (next === cur) next = [...cur];
          next[idx] = { ...seg, text };
        }
        return next;
      });
    });
  }, []);

  const pushUndo = useCallback(() => {
    redoStack.current = [];
    undoStack.current.push(cloneSegments(segmentsRef.current));
    if (undoStack.current.length > 40) undoStack.current.shift();
  }, []);

  const pushUndoForTextEdit = useCallback(
    (idx: number) => {
      const now = Date.now();
      const prev = textEditUndoRef.current;
      const shouldSnapshot = !prev || prev.idx !== idx || now - prev.atMs > 1200;
      if (shouldSnapshot) pushUndo();
      textEditUndoRef.current = { idx, atMs: now };
    },
    [pushUndo],
  );

  const refreshProjects = useCallback(async () => {
    try {
      setError("");
      const list = await p1.p1ProjectList();
      setProjects(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const refreshBundledAsrDiag = useCallback(async () => {
    try {
      const r = await p1.bundledAsrLaunchReport();
      setBundledAsrDiag(r);
    } catch {
      setBundledAsrDiag(null);
    }
  }, []);

  const refreshAsrHealth = useCallback(async () => {
    setAsrHealth("checking");
    setAsrHealthDetail("");
    setAsrCaps(null);
    const url = asrHealthUrl();
    try {
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        let data: unknown;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        const parsed = parseAsrHealthJson(data);
        if (!parsed) {
          setAsrHealth("error");
          setAsrHealthDetail(`无法解析 ${url} 的能力字段（响应格式不符合 rushi-asr /health 契约）。`);
          await refreshBundledAsrDiag();
          return;
        }
        setAsrCaps(parsed);
        setAsrHealth("ok");
        await refreshBundledAsrDiag();
        return;
      }
      setAsrHealth("error");
      setAsrHealthDetail(`无法访问 ${url}（HTTP ${res.status}）。请先在本机启动 ASR：见说明中「启动本地 ASR」一节。`);
    } catch (e) {
      setAsrHealth("error");
      const msg = e instanceof Error ? e.message : String(e);
      setAsrHealthDetail(`无法连接 ${url}：${msg}。请确认已在终端启动 python -m rushi_asr，且地址与 VITE_ASR_BASE_URL 一致。`);
    }
    await refreshBundledAsrDiag();
  }, [refreshBundledAsrDiag]);

  useEffect(() => {
    void refreshAsrHealth();
  }, [refreshAsrHealth]);

  const asrHealthDetailDisplay = useMemo(() => {
    if (asrHealth !== "error") return asrHealthDetail;
    if (
      isDefaultBundledAsrTarget() &&
      bundledAsrDiag?.attempted &&
      !bundledAsrDiag.success &&
      bundledAsrDiag.detail
    ) {
      return `${asrHealthDetail}\n\n【安装包内置推理侧车】\n${bundledAsrDiag.detail}`;
    }
    return asrHealthDetail;
  }, [asrHealth, asrHealthDetail, bundledAsrDiag]);

  const prepareDefaultFunasrModel = useCallback(async () => {
    prepareModelAbortRef.current?.abort();
    const ac = new AbortController();
    prepareModelAbortRef.current = ac;
    const base = asrBaseUrl().replace(/\/+$/, "");
    const urlAsync = `${base}/v1/models/prepare-default/async`;
    const urlStatus = `${base}/v1/models/prepare-status`;
    const deadlineMs = 900_000;
    setPrepareModelBusy(true);
    setPrepareModelFailure(null);
    setPrepareModelProgress(6);
    setFunasrInstallMessage("");
    setError("");
    const runT0 = Date.now();
    const deadline = runT0 + deadlineMs;
    const formatWait = () => {
      const secs = Math.floor((Date.now() - runT0) / 1000);
      const mm = Math.floor(secs / 60);
      const ss = secs % 60;
      return `${mm}:${ss.toString().padStart(2, "0")}`;
    };
    const bumpProgress = () => {
      const elapsed = Date.now() - runT0;
      setPrepareModelProgress(Math.min(92, 6 + Math.floor((elapsed / deadlineMs) * 86)));
    };
    try {
      const start = await fetch(urlAsync, { method: "POST", signal: ac.signal });
      const sj = (await start.json().catch(() => ({}))) as Record<string, unknown>;
      if (!start.ok) {
        const d = sj.detail;
        const code =
          typeof d === "string"
            ? d
            : start.status === 507
              ? "model_prepare_disk_full"
              : `http_${start.status}`;
        setPrepareModelFailure(describePrepareModelFailure(code));
        return;
      }
      if (sj.started !== true && sj.reason === "already_running") {
        setFunasrInstallMessage("已有模型下载任务在进行，正在同步进度…");
      }
      while (Date.now() < deadline) {
        if (ac.signal.aborted) return;
        bumpProgress();
        const stRes = await fetch(urlStatus, { signal: ac.signal });
        const st = (await stRes.json().catch(() => ({}))) as Record<string, unknown>;
        const phase = typeof st.phase === "string" ? st.phase : "?";
        if (phase === "running") {
          setFunasrInstallMessage(
            `正在从 ModelScope 拉取默认权重（内置 SenseVoiceSmall）… 已等待 ${formatWait()}。请保持联网，尽量不要关闭运行 ASR 的终端。`,
          );
        } else if (phase === "idle") {
          if (Date.now() - runT0 < 4000) {
            setFunasrInstallMessage("正在启动后台下载任务，请稍候…");
          } else {
            setFunasrInstallMessage("模型准备状态仍为 idle：请重启 ASR（python -m rushi_asr）后再试。");
          }
        } else if (phase === "?") {
          setFunasrInstallMessage("无法读取模型准备状态，请确认 rushi-asr 已升级后重试。");
        }
        if (phase === "done") {
          setPrepareModelProgress(100);
          const result = st.result as Record<string, unknown> | null | undefined;
          const warns = Array.isArray(result?.warnings)
            ? (result?.warnings as string[]).join("；")
            : "";
          setFunasrInstallMessage(
            [
              "默认模型权重已准备（或已在缓存中）。",
              warns ? `提示：${warns}` : "",
              typeof result?.path === "string" ? `缓存路径：${result.path}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          );
          await refreshAsrHealth();
          return;
        }
        if (phase === "error") {
          setFunasrInstallMessage("");
          const code = typeof st.error_code === "string" ? st.error_code : "unknown";
          setPrepareModelFailure(describePrepareModelFailure(code));
          return;
        }
        await new Promise<void>((r, rej) => {
          const t = setTimeout(r, 1000);
          ac.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(t);
              rej(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
      }
      setFunasrInstallMessage("");
      setPrepareModelFailure(describePrepareModelFailure("client_timeout"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setFunasrInstallMessage("");
      setPrepareModelFailure(describePrepareModelFailure("fetch_failed"));
    } finally {
      setPrepareModelBusy(false);
      setPrepareModelProgress(0);
    }
  }, [refreshAsrHealth]);

  const retryBundledAsrSidecar = useCallback(async () => {
    setError("");
    try {
      await p1.p1RetryBundledAsrSidecar();
      await refreshBundledAsrDiag();
      await refreshAsrHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [refreshAsrHealth, refreshBundledAsrDiag]);

  const openAppDataFolder = useCallback(async () => {
    setError("");
    try {
      await p1.p1OpenAppDataFolder();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const applyDetail = useCallback((d: ProjectDetail) => {
    segmentBoundsLiveGestureRef.current = false;
    setCurrent(d);
    setSegments(cloneSegments(d.segments));
    setSelectedIdx(0);
    setTranscribeHints([]);
    setPickedPath(null);
    undoStack.current = [];
    redoStack.current = [];
    textEditUndoRef.current = null;
    try {
      setAudioSrc(convertFileSrc(d.audio_storage_path));
    } catch {
      setAudioSrc(null);
    }
  }, []);

  const pickAudio = useCallback(async () => {
    setError("");
    try {
      const p = await p1.p1PickAudioPath();
      setPickedPath(p ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const clearPickedAudio = useCallback(() => {
    setPickedPath(null);
  }, []);

  const createProject = useCallback(async () => {
    if (!pickedPath) {
      setError("请先选择音频文件。");
      return;
    }
    beginBusy("create");
    setError("");
    try {
      const d = await p1.p1ProjectCreate(newName.trim() || "未命名项目", pickedPath);
      applyDetail(d);
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [pickedPath, newName, applyDetail, refreshProjects, beginBusy, endBusy]);

  const loadProject = useCallback(
    async (id: string) => {
      beginBusy("load");
      setError("");
      try {
        const d = await p1.p1ProjectLoad(id);
        applyDetail(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        endBusy();
      }
    },
    [applyDetail, beginBusy, endBusy],
  );

  const runTranscribe = useCallback(async () => {
    if (!current) return;
    if (isSttOnlineEnabledButIncomplete()) {
      setError(
        "已启用在线 STT：请在「环境与 ASR」中选择厂商、填写 API Key 并点击保存在线配置；自建网关还须填写 HTTPS 转写 URL。OpenAI / AssemblyAI 可留空 URL 使用默认端点。",
      );
      return;
    }
    beginBusy("transcribe");
    setError("");
    setTranscribeHints([]);
    try {
      const online = tryBuildP1OnlineTranscribeBridgePayload();
      const out = await p1.p1ProjectRunTranscribe(current.id, asrBaseUrl(), online ?? null);
      applyDetail(out.detail);
      const hints = deriveTranscribeHints(out.engine, out.warnings, out.detail.segments);
      if (import.meta.env.DEV && hints.length > 0) {
        hints.push("（开发模式）详见仓库 services/asr/README.md。");
      }
      setTranscribeHints(hints);
      void refreshAsrHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [current, applyDetail, refreshAsrHealth, beginBusy, endBusy]);

  const saveSegments = useCallback(async () => {
    if (!current) return;
    beginBusy("save");
    setError("");
    try {
      flushP1SegmentTextDraftsFromDom();
      const normalized = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
      await p1.p1ProjectSaveSegments(current.id, normalized);
      const d = await p1.p1ProjectLoad(current.id);
      applyDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [current, applyDetail, flushP1SegmentTextDraftsFromDom, beginBusy, endBusy]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(cloneSegments(segmentsRef.current));
    if (redoStack.current.length > 40) redoStack.current.shift();
    textEditUndoRef.current = null;
    setSegments(prev);
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(cloneSegments(segmentsRef.current));
    if (undoStack.current.length > 40) undoStack.current.shift();
    textEditUndoRef.current = null;
    setSegments(next);
  }, []);

  const updateSegmentText = useCallback(
    (idx: number, text: string) => {
      const prev = segmentsRef.current;
      const cur = prev[idx];
      if (!cur || cur.text === text) return;
      pushUndoForTextEdit(idx);
      setSegments((p) => {
        const c = p[idx];
        if (!c || c.text === text) return p;
        const out = [...p];
        out[idx] = { ...c, text };
        return out;
      });
    },
    [pushUndoForTextEdit],
  );

  const updateSegmentTime = useCallback(
    (idx: number, field: "start_sec" | "end_sec", value: number) => {
      pushUndo();
      setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
    },
    [pushUndo],
  );

  const updateSegmentBounds = useCallback(
    (idx: number, startSec: number, endSec: number, phase: "live" | "commit" = "commit") => {
      const prev = segmentsRef.current;
      const s = prev[idx];
      if (!s) return;
      let lo = Math.min(startSec, endSec);
      let hi = Math.max(startSec, endSec);
      const prevSeg = prev[idx - 1];
      const nextSeg = prev[idx + 1];
      if (prevSeg) lo = Math.max(lo, prevSeg.end_sec + 1e-6);
      if (nextSeg) hi = Math.min(hi, nextSeg.start_sec - 1e-6);
      lo = roundSec3(lo);
      hi = roundSec3(hi);
      if (hi <= lo + 0.02) {
        if (phase === "commit") segmentBoundsLiveGestureRef.current = false;
        return;
      }
      if (Math.abs(s.start_sec - lo) < 0.0005 && Math.abs(s.end_sec - hi) < 0.0005) {
        if (phase === "commit") segmentBoundsLiveGestureRef.current = false;
        return;
      }

      if (phase === "live") {
        if (!segmentBoundsLiveGestureRef.current) {
          segmentBoundsLiveGestureRef.current = true;
          pushUndo();
        }
        setSegments((p) => p.map((x, i) => (i === idx ? { ...x, start_sec: lo, end_sec: hi } : x)));
        return;
      }

      const hadLiveGesture = segmentBoundsLiveGestureRef.current;
      segmentBoundsLiveGestureRef.current = false;
      if (!hadLiveGesture) pushUndo();
      setSegments((p) => p.map((x, i) => (i === idx ? { ...x, start_sec: lo, end_sec: hi } : x)));
    },
    [pushUndo],
  );

  const splitAtSelection = useCallback(() => {
    flushP1SegmentTextDraftsFromDom();
    const segs = segmentsRef.current;
    if (segs.length === 0) return;
    const i = Math.min(selectedIdx, segs.length - 1);
    const s = segs[i];
    if (!s) return;
    const mid = (s.start_sec + s.end_sec) / 2;
    const pair = buildSplitPair(s, mid);
    if (!pair) {
      setError("语段太短，无法拆分。");
      return;
    }
    setError("");
    pushUndo();
    setSegments((prev) => {
      const out = [...prev];
      out.splice(i, 1, pair.left, pair.right);
      return reindexSegments(out);
    });
    setSelectedIdx(i + 1);
  }, [flushP1SegmentTextDraftsFromDom, selectedIdx, pushUndo]);

  const splitAtPlayhead = useCallback(
    (timeSec: number) => {
      flushP1SegmentTextDraftsFromDom();
      const t = roundSec3(timeSec);
      const segs = segmentsRef.current;
      const i = segs.findIndex((s) => t > s.start_sec + 0.02 && t < s.end_sec - 0.02);
      if (i < 0) {
        setError("指针时间不在任一语段内，无法拆分。");
        return;
      }
      const s = segs[i];
      if (!s) return;
      const pair = buildSplitPair(s, t);
      if (!pair) {
        setError("语段太短，无法在该时间拆分。");
        return;
      }
      setError("");
      pushUndo();
      setSegments((prev) => {
        const out = [...prev];
        out.splice(i, 1, pair.left, pair.right);
        return reindexSegments(out);
      });
      setSelectedIdx(i + 1);
    },
    [flushP1SegmentTextDraftsFromDom, pushUndo],
  );

  const mergeWithPrevAt = useCallback(
    (idx: number) => {
      if (idx <= 0) return;
      flushP1SegmentTextDraftsFromDom();
      const segs = segmentsRef.current;
      const a = segs[idx - 1];
      const b = segs[idx];
      if (!a || !b) return;
      pushUndo();
      const merged = mergeTwoSegments(a, b);
      setSegments((p) => {
        const out = [...p];
        out.splice(idx - 1, 2, merged);
        return reindexSegments(out);
      });
      setSelectedIdx(idx - 1);
    },
    [flushP1SegmentTextDraftsFromDom, pushUndo],
  );

  const mergeWithNextAt = useCallback(
    (idx: number) => {
      flushP1SegmentTextDraftsFromDom();
      const segs = segmentsRef.current;
      if (idx >= segs.length - 1) return;
      const a = segs[idx];
      const b = segs[idx + 1];
      if (!a || !b) return;
      pushUndo();
      const merged = mergeTwoSegments(a, b);
      setSegments((p) => {
        const out = [...p];
        out.splice(idx, 2, merged);
        return reindexSegments(out);
      });
      setSelectedIdx(idx);
    },
    [flushP1SegmentTextDraftsFromDom, pushUndo],
  );

  const mergeWithPrev = useCallback(() => {
    mergeWithPrevAt(selectedIdx);
  }, [mergeWithPrevAt, selectedIdx]);

  const mergeWithNext = useCallback(() => {
    mergeWithNextAt(selectedIdx);
  }, [mergeWithNextAt, selectedIdx]);

  const deleteSegmentAt = useCallback(
    (idx: number) => {
      flushP1SegmentTextDraftsFromDom();
      const segs = segmentsRef.current;
      if (idx < 0 || idx >= segs.length) return;
      setError("");
      pushUndo();
      setSegments((prev) => reindexSegments(prev.filter((_, j) => j !== idx)));
      setSelectedIdx((prev) => {
        const nextLen = segs.length - 1;
        if (nextLen <= 0) return 0;
        let next = prev;
        if (idx < prev) next -= 1;
        else if (idx === prev) next = Math.min(prev, nextLen - 1);
        return Math.max(0, Math.min(next, nextLen - 1));
      });
    },
    [flushP1SegmentTextDraftsFromDom, pushUndo],
  );

  /** 在当前语段之后插入一条空白语段（需与下一条之间留有间隙） */
  const insertSegmentAfter = useCallback(
    (idx: number) => {
      flushP1SegmentTextDraftsFromDom();
      const segs = segmentsRef.current;
      if (idx < 0 || idx >= segs.length) return;
      const a = segs[idx];
      const b = segs[idx + 1];
      if (!a) return;
      const startSec = a.end_sec;
      let endSec: number;
      if (b) {
        const gap = b.start_sec - a.end_sec;
        if (!Number.isFinite(gap) || gap < 0.12) {
          setError("与下一条无足够间隙：请在波形区拖动语段边界留出空档后再插入。");
          return;
        }
        endSec = a.end_sec + Math.min(Math.max(gap * 0.45, 0.08), 2);
      } else {
        endSec = a.end_sec + 1;
      }
      if (endSec <= startSec + 0.04) {
        setError("无法插入：时间范围无效。");
        return;
      }
      setError("");
      pushUndo();
      const newSeg: SegmentDto = {
        idx: 0,
        start_sec: startSec,
        end_sec: endSec,
        text: "",
        confidence: null,
        low_confidence: false,
        detail: null,
      };
      setSegments((prev) => {
        const out = [...prev.slice(0, idx + 1), newSeg, ...prev.slice(idx + 1)];
        return reindexSegments(out);
      });
      setSelectedIdx(idx + 1);
    },
    [flushP1SegmentTextDraftsFromDom, pushUndo],
  );

  /** 波形上拖选的时间范围插入一条新语段（不与已有区间重叠） */
  const insertSegmentFromTimeRange = useCallback(
    (startSec: number, endSec: number) => {
      if (busy) return;
      flushP1SegmentTextDraftsFromDom();
      const lo = roundSec3(Math.min(startSec, endSec));
      const hi = roundSec3(Math.max(startSec, endSec));
      if (hi <= lo + 0.05) {
        setError("选区过短。");
        return;
      }
      const segs = segmentsRef.current;
      for (const s of segs) {
        if (lo < s.end_sec && hi > s.start_sec) {
          setError("选区与已有语段重叠。");
          return;
        }
      }
      setError("");
      pushUndo();
      let insertAt = segs.findIndex((s) => s.start_sec > lo);
      if (insertAt === -1) insertAt = segs.length;
      const newSeg: SegmentDto = {
        idx: 0,
        start_sec: lo,
        end_sec: hi,
        text: "",
        confidence: null,
        low_confidence: false,
        detail: null,
      };
      setSegments((prev) => {
        const out = [...prev.slice(0, insertAt), newSeg, ...prev.slice(insertAt)];
        return reindexSegments(out);
      });
      setSelectedIdx(insertAt);
    },
    [busy, flushP1SegmentTextDraftsFromDom, pushUndo],
  );

  const exportTxt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushP1SegmentTextDraftsFromDom();
    const rows: ExportSegment[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.p1ExportTextFile(safeExportBasename(current.name, "txt"), formatTxt(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, flushP1SegmentTextDraftsFromDom]);

  const exportSrt = useCallback(async () => {
    if (!current) return;
    setError("");
    flushP1SegmentTextDraftsFromDom();
    const rows: ExportSegment[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.p1ExportTextFile(safeExportBasename(current.name, "srt"), formatSrt(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, flushP1SegmentTextDraftsFromDom]);

  const exportDocx = useCallback(
    async (mode: P3DocxExportMode) => {
      if (!current) return;
      setError("");
      flushP1SegmentTextDraftsFromDom();
      const normalized: SegmentDto[] = segmentsRef.current.map((s, i) => ({ ...s, idx: i }));
      try {
        await p3ExportDocx(safeExportBasename(current.name, "docx"), current.name, mode, normalized);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [current, flushP1SegmentTextDraftsFromDom],
  );

  const exportDiagnosticBundle = useCallback(async () => {
    setError("");
    try {
      await p4ExportDiagnosticBundle();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const installFunasrDepsInteractive = useCallback(async () => {
    beginBusy("install_funasr");
    setError("");
    setPrepareModelFailure(null);
    setFunasrInstallMessage("");
    try {
      const log = await p1.p1InstallFunasrDepsInteractive();
      if (log != null && log.length > 0) {
        setFunasrInstallMessage(
          [
            "已在所选仓库中执行安装脚本。未设置 RUSHI_FUNASR_MODEL 时将使用内置默认模型 iic/SenseVoiceSmall（首次转写会从网络拉取权重）。",
            "停止并重新执行 python -m rushi_asr，然后回到本页点「重新检测 ASR」。",
            "",
            "--- 脚本输出（节选）---",
            log.length > 4000 ? `${log.slice(0, 4000)}…` : log,
          ].join("\n"),
        );
      }
      void refreshAsrHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBusy();
    }
  }, [refreshAsrHealth, beginBusy, endBusy]);

  const copyFunasrManualCommands = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(funasrManualSetupCommands());
      setFunasrInstallMessage("已复制手动安装命令到剪贴板（请在终端粘贴执行）。");
    } catch {
      setError("无法写入剪贴板，请手动复制 services/asr/README.md 中的命令。");
    }
  }, []);

  const deleteProject = useCallback(
    async (id: string) => {
      if (!window.confirm("确定删除该项目及本地音频副本？")) return;
      beginBusy("delete");
      setError("");
      try {
        await p1.p1ProjectDelete(id);
        if (current?.id === id) {
          segmentBoundsLiveGestureRef.current = false;
          setCurrent(null);
          setSegments([]);
          setAudioSrc(null);
          setTranscribeHints([]);
          undoStack.current = [];
          redoStack.current = [];
          textEditUndoRef.current = null;
        }
        await refreshProjects();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        endBusy();
      }
    },
    [current, refreshProjects, beginBusy, endBusy],
  );

  return {
    projects,
    current,
    segments,
    selectedIdx,
    setSelectedIdx,
    audioSrc,
    error,
    asrHealth,
    asrHealthDetail: asrHealthDetailDisplay,
    bundledAsrDiag,
    asrCaps,
    sttOnlineBridgeReady,
    bumpSttOnlineRuntimeChanged,
    funasrInstallMessage,
    prepareModelBusy,
    prepareModelProgress,
    prepareModelFailure,
    prepareDefaultFunasrModel,
    retryBundledAsrSidecar,
    openAppDataFolder,
    transcribeHints,
    refreshAsrHealth,
    installFunasrDepsInteractive,
    copyFunasrManualCommands,
    busy,
    busyReason,
    newName,
    setNewName,
    pickedPath,
    refreshProjects,
    pickAudio,
    clearPickedAudio,
    createProject,
    loadProject,
    runTranscribe,
    saveSegments,
    undo,
    redo,
    updateSegmentText,
    updateSegmentTime,
    updateSegmentBounds,
    splitAtSelection,
    splitAtPlayhead,
    mergeWithNext,
    mergeWithPrev,
    mergeWithNextAt,
    mergeWithPrevAt,
    deleteSegmentAt,
    insertSegmentAfter,
    insertSegmentFromTimeRange,
    exportTxt,
    exportSrt,
    exportDocx,
    exportDiagnosticBundle,
    deleteProject,
  };
}

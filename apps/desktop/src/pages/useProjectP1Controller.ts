import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { asrBaseUrl, asrHealthUrl, isDefaultBundledAsrTarget } from "../config/env";
import { deriveTranscribeHints } from "../services/asrTranscribeHints";
import { formatSrt, formatTxt, type ExportSegment } from "../services/exportFormatters";
import type { AsrHealthCapabilities, ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/p1Api";
import * as p1 from "../tauri/p1Api";
import { p3ExportDocx, type P3DocxExportMode } from "../tauri/p3ExportDocxApi";
import { p4ExportDiagnosticBundle } from "../tauri/p4DiagnosticApi";
import { describePrepareModelFailure, type PrepareModelFailureCopy } from "./prepareModelDownloadCopy";

function cloneSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((s) => ({ ...s }));
}

/** 避免默认文件名含路径分隔符等非法字符。 */
function safeExportBasename(name: string, ext: "txt" | "srt" | "docx"): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "export";
  return `${base}.${ext}`;
}

export type AsrHealthState = "checking" | "ok" | "error";

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
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("未命名项目");
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const undoStack = useRef<SegmentDto[][]>([]);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const pushUndo = useCallback(() => {
    undoStack.current.push(cloneSegments(segmentsRef.current));
    if (undoStack.current.length > 40) undoStack.current.shift();
  }, []);

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
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        let data: unknown;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        setAsrCaps(parseAsrHealthJson(data));
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
    const base = asrBaseUrl().replace(/\/$/, "");
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
      const start = await fetch(urlAsync, { method: "POST" });
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
        bumpProgress();
        const stRes = await fetch(urlStatus);
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
        await new Promise((r) => setTimeout(r, 1000));
      }
      setFunasrInstallMessage("");
      setPrepareModelFailure(describePrepareModelFailure("client_timeout"));
    } catch {
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
    setCurrent(d);
    setSegments(cloneSegments(d.segments));
    setSelectedIdx(0);
    setTranscribeHints([]);
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
      setPickedPath(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const createProject = useCallback(async () => {
    if (!pickedPath) {
      setError("请先选择音频文件。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const d = await p1.p1ProjectCreate(newName.trim() || "未命名项目", pickedPath);
      applyDetail(d);
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [pickedPath, newName, applyDetail, refreshProjects]);

  const loadProject = useCallback(
    async (id: string) => {
      setBusy(true);
      setError("");
      try {
        const d = await p1.p1ProjectLoad(id);
        applyDetail(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [applyDetail],
  );

  const runTranscribe = useCallback(async () => {
    if (!current) return;
    setBusy(true);
    setError("");
    setTranscribeHints([]);
    try {
      const out = await p1.p1ProjectRunTranscribe(current.id, asrBaseUrl());
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
      setBusy(false);
    }
  }, [current, applyDetail, refreshAsrHealth]);

  const saveSegments = useCallback(async () => {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const normalized = segments.map((s, i) => ({ ...s, idx: i }));
      await p1.p1ProjectSaveSegments(current.id, normalized);
      undoStack.current = [];
      const d = await p1.p1ProjectLoad(current.id);
      applyDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [current, segments, applyDetail]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (prev) setSegments(prev);
  }, []);

  const updateSegmentText = useCallback((idx: number, text: string) => {
    setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, text } : s)));
  }, []);

  const updateSegmentTime = useCallback(
    (idx: number, field: "start_sec" | "end_sec", value: number) => {
      pushUndo();
      setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
    },
    [pushUndo],
  );

  const splitAtSelection = useCallback(() => {
    if (segments.length === 0) return;
    const i = Math.min(selectedIdx, segments.length - 1);
    const s = segments[i];
    const mid = (s.start_sec + s.end_sec) / 2;
    if (mid <= s.start_sec + 0.02 || mid >= s.end_sec - 0.02) {
      setError("语段太短，无法拆分。");
      return;
    }
    setError("");
    pushUndo();
    const left: SegmentDto = { ...s, end_sec: mid, text: s.text };
    const right: SegmentDto = {
      idx: s.idx + 1,
      start_sec: mid,
      end_sec: s.end_sec,
      text: "",
      confidence: null,
      low_confidence: false,
      detail: null,
    };
    setSegments((prev) => {
      const out = [...prev];
      out.splice(i, 1, left, right);
      return out.map((x, j) => ({ ...x, idx: j }));
    });
    setSelectedIdx(i + 1);
  }, [segments, selectedIdx, pushUndo]);

  const mergeWithNext = useCallback(() => {
    if (selectedIdx >= segments.length - 1) return;
    pushUndo();
    const a = segments[selectedIdx];
    const b = segments[selectedIdx + 1];
    const confA = a.confidence ?? null;
    const confB = b.confidence ?? null;
    const merged: SegmentDto = {
      idx: a.idx,
      start_sec: a.start_sec,
      end_sec: b.end_sec,
      text: `${a.text}\n${b.text}`.trim(),
      confidence:
        confA != null && confB != null ? Math.min(confA, confB) : (confA ?? confB ?? null),
      low_confidence: Boolean(a.low_confidence || b.low_confidence),
      detail: [a.detail, b.detail].filter(Boolean).join(" / ") || null,
    };
    setSegments((prev) => {
      const out = [...prev];
      out.splice(selectedIdx, 2, merged);
      return out.map((x, j) => ({ ...x, idx: j }));
    });
  }, [segments, selectedIdx, pushUndo]);

  const exportTxt = useCallback(async () => {
    if (!current) return;
    setError("");
    const rows: ExportSegment[] = segments.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.p1ExportTextFile(safeExportBasename(current.name, "txt"), formatTxt(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, segments]);

  const exportSrt = useCallback(async () => {
    if (!current) return;
    setError("");
    const rows: ExportSegment[] = segments.map((s, i) => ({ ...s, idx: i }));
    try {
      await p1.p1ExportTextFile(safeExportBasename(current.name, "srt"), formatSrt(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [current, segments]);

  const exportDocx = useCallback(
    async (mode: P3DocxExportMode) => {
      if (!current) return;
      setError("");
      const normalized: SegmentDto[] = segments.map((s, i) => ({ ...s, idx: i }));
      try {
        await p3ExportDocx(safeExportBasename(current.name, "docx"), current.name, mode, normalized);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [current, segments],
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
    setBusy(true);
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
      setBusy(false);
    }
  }, [refreshAsrHealth]);

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
      setBusy(true);
      setError("");
      try {
        await p1.p1ProjectDelete(id);
        if (current?.id === id) {
          setCurrent(null);
          setSegments([]);
          setAudioSrc(null);
          setTranscribeHints([]);
        }
        await refreshProjects();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [current, refreshProjects],
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
    newName,
    setNewName,
    pickedPath,
    refreshProjects,
    pickAudio,
    createProject,
    loadProject,
    runTranscribe,
    saveSegments,
    undo,
    updateSegmentText,
    updateSegmentTime,
    splitAtSelection,
    mergeWithNext,
    exportTxt,
    exportSrt,
    exportDocx,
    exportDiagnosticBundle,
    deleteProject,
  };
}

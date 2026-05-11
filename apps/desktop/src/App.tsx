import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createHttpAsrProvider } from "./api/httpAsrProvider";
import { asrBaseUrl, asrHealthUrl } from "./config/env";
import type { TranscriptionResult } from "./contracts";
import "./App.css";

type AsrHealth = { status?: string; service?: string };

export default function App() {
  const [shellVersion, setShellVersion] = useState<string>("…");
  const [asrUrl] = useState(() => asrBaseUrl());
  const [asrStatus, setAsrStatus] = useState<string>("未检查");
  const [asrBody, setAsrBody] = useState<string>("");
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string>("");
  const [txResult, setTxResult] = useState<TranscriptionResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void invoke<string>("app_version").then(setShellVersion).catch(() => {
      setShellVersion("（仅 Vite 预览：无 Tauri）");
    });
  }, []);

  const checkAsr = useCallback(async () => {
    setAsrStatus("检查中…");
    setAsrBody("");
    try {
      const res = await fetch(asrHealthUrl(asrUrl), { method: "GET" });
      const text = await res.text();
      setAsrBody(text);
      if (!res.ok) {
        setAsrStatus(`HTTP ${res.status}`);
        return;
      }
      let parsed: AsrHealth | null = null;
      try {
        parsed = JSON.parse(text) as AsrHealth;
      } catch {
        parsed = null;
      }
      setAsrStatus(parsed?.status === "ok" ? "可用" : "已响应（非预期 JSON）");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAsrStatus("不可达");
      setAsrBody(msg);
    }
  }, [asrUrl]);

  const runTranscribe = useCallback(async () => {
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setTxError("请先选择音频或视频文件。");
      return;
    }
    setTxError("");
    setTxResult(null);
    setTxLoading(true);
    try {
      const provider = createHttpAsrProvider(asrUrl);
      const result = await provider.transcribeFile(file);
      setTxResult(result);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e));
    } finally {
      setTxLoading(false);
    }
  }, [asrUrl]);

  return (
    <main className="shell">
      <header className="shell-header">
        <h1 className="shell-title">如是我闻</h1>
        <p className="shell-sub">本地转写与校对（P0 原型）</p>
      </header>

      <section className="panel">
        <h2 className="panel-title">本地 ASR 服务</h2>
        <p className="panel-meta">
          基址 <code>{asrUrl}</code>（可用 <code>VITE_ASR_BASE_URL</code> 覆盖）
        </p>
        <button type="button" className="primary" onClick={() => void checkAsr()}>
          检查健康检查
        </button>
        <p className="panel-status">
          状态：<strong>{asrStatus}</strong>
        </p>
        {asrBody ? (
          <pre className="panel-pre">{asrBody}</pre>
        ) : null}
        <p className="panel-hint">
          另开终端运行：<code>python -m rushi_asr</code>（仓库 <code>services/asr</code>）后再点检查。
        </p>
      </section>

      <section className="panel panel-spaced">
        <h2 className="panel-title">转写（契约 v1）</h2>
        <p className="panel-meta">
          选择文件后 POST 到 <code>/v1/transcribe</code>；未配置 FunASR 时为 <strong>stub</strong>（仅验证 FFmpeg
          + JSON 形状）。
        </p>
        <div className="row-gap">
          <input ref={fileRef} type="file" accept="audio/*,video/*,.wav,.mp3,.m4a,.aac,.flac,.ogg,.mp4,.webm,.mov" />
          <button type="button" className="primary" disabled={txLoading} onClick={() => void runTranscribe()}>
            {txLoading ? "转写中…" : "开始转写"}
          </button>
        </div>
        {txError ? <p className="panel-err">{txError}</p> : null}
        {txResult?.error ? (
          <p className="panel-err">
            {txResult.error.code}: {txResult.error.message}
          </p>
        ) : null}
        {txResult?.warnings?.length ? (
          <ul className="panel-warn">
            {txResult.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
        {txResult ? (
          <div className="tx-meta">
            <span>
              engine=<code>{txResult.engine}</code>
            </span>
            <span>
              duration_sec=<code>{txResult.duration_sec ?? "null"}</code>
            </span>
            <span>
              segments=<code>{txResult.segments.length}</code>
            </span>
          </div>
        ) : null}
        {txResult?.segments?.length ? (
          <div className="seg-table-wrap">
            <table className="seg-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>start</th>
                  <th>end</th>
                  <th>text</th>
                  <th>conf.</th>
                </tr>
              </thead>
              <tbody>
                {txResult.segments.map((s, i) => (
                  <tr key={`${s.start_sec}-${s.end_sec}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{s.start_sec.toFixed(3)}</td>
                    <td>{s.end_sec.toFixed(3)}</td>
                    <td className="seg-text">{s.text ? s.text : <span className="muted">（空）</span>}</td>
                    <td>{s.confidence === null || s.confidence === undefined ? "—" : s.confidence.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <footer className="shell-footer">
        壳版本（Rust）：<code>{shellVersion}</code>
      </footer>
    </main>
  );
}

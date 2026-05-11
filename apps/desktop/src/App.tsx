import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { asrBaseUrl, asrHealthUrl } from "./config/env";
import "./App.css";

type AsrHealth = { status?: string; service?: string };

export default function App() {
  const [shellVersion, setShellVersion] = useState<string>("…");
  const [asrUrl] = useState(() => asrBaseUrl());
  const [asrStatus, setAsrStatus] = useState<string>("未检查");
  const [asrBody, setAsrBody] = useState<string>("");

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

  return (
    <main className="shell">
      <header className="shell-header">
        <h1 className="shell-title">如是我闻</h1>
        <p className="shell-sub">本地转写与校对（骨架）</p>
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

      <footer className="shell-footer">
        壳版本（Rust）：<code>{shellVersion}</code>
      </footer>
    </main>
  );
}

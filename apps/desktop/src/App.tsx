import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProjectP1Panel } from "./components/ProjectP1Panel";
import "./App.css";

export default function App() {
  const [shellVersion, setShellVersion] = useState<string>("…");

  useEffect(() => {
    let cancelled = false;
    void invoke<string>("app_version").then((v) => {
      if (!cancelled) setShellVersion(v);
    }).catch(() => {
      if (!cancelled) setShellVersion("（仅 Vite 预览：无 Tauri）");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell">
      <div className="shell-body">
        <ProjectP1Panel />
      </div>

      <footer className="shell-footer">
        壳版本（Rust）：<code>{shellVersion}</code>
      </footer>
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { ollamaDetectStatus, type OllamaDetectResponse } from "../tauri/postprocessApi";

type Tone = "ok" | "warn" | "error" | "idle";

function toneFromDetect(d: OllamaDetectResponse | null, busy: boolean): Tone {
  if (busy || !d) return "idle";
  if (!d.reachable) return "error";
  if (!d.hasQwen25_7b) return "warn";
  return "ok";
}

const toneClass: Record<Tone, string> = {
  ok: "bg-zen-saffron/10 text-notion-text",
  warn: "bg-notion-sidebar-hover text-notion-text-muted",
  error: "bg-zen-cinnabar/10 text-zen-cinnabar",
  idle: "bg-notion-sidebar-hover text-notion-text-muted",
};

type Props = {
  refreshSeq?: number;
  disabled?: boolean;
};

/** 本机 LLM（Ollama）第三路灯 — LLM-LOC-4a */
export function EnvOllamaStatusBanner({ refreshSeq = 0, disabled }: Props) {
  const [detect, setDetect] = useState<OllamaDetectResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const out = await ollamaDetectStatus();
      setDetect(out);
    } catch (e) {
      setDetect({
        reachable: false,
        modelCount: 0,
        hasQwen25_7b: false,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshSeq]);

  const tone = toneFromDetect(detect, busy);
  const dotClass =
    tone === "ok"
      ? "bg-zen-saffron"
      : tone === "warn"
        ? "bg-notion-text-muted"
        : tone === "error"
          ? "bg-zen-cinnabar"
          : "bg-notion-divider";

  return (
    <div
      className={["rounded-lg px-3 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", toneClass[tone]].join(
        " ",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2 min-w-0">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className={PANEL_TYPOGRAPHY.fieldLabel}>本机 LLM（Ollama）</p>
          <p className={PANEL_TYPOGRAPHY.meta}>
            {busy ? "正在检测 127.0.0.1:11434…" : detect?.message ?? "—"}
          </p>
        </div>
      </div>
      <button
        type="button"
        className={CONTROL_BTN_SECONDARY}
        disabled={disabled || busy}
        onClick={() => void refresh()}
      >
        {busy ? "检测中…" : "刷新检测"}
      </button>
    </div>
  );
}

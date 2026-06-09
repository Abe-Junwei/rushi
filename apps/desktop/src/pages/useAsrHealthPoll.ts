import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { asrBaseUrl, asrHealthUrl } from "../config/env";
import type { AsrHealthCapabilities } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { parseCatalogStatusFromHealth } from "../services/asr/localAsrModelCatalog";
import { loopbackFetch } from "../services/asr/loopbackFetch";
import { parseAsrHealthJson } from "../services/asr/asrHealthParse";

export type AsrHealthState = "checking" | "ok" | "error";

export type AsrHealthRefreshOptions = {
  /** When false, skip flipping UI to「检测中」during background polls. Default true. */
  touchUi?: boolean;
};

export type AsrHealthRefreshResult = {
  health: AsrHealthState;
  healthDetail: string;
  caps: AsrHealthCapabilities | null;
  healthJson: unknown;
  rootJson: unknown;
};

let lastAsrHealthRefreshResult: AsrHealthRefreshResult | undefined;

export function getLastAsrHealthRefreshResult(): AsrHealthRefreshResult | undefined {
  return lastAsrHealthRefreshResult;
}

export function resetLastAsrHealthRefreshResultForTests(): void {
  lastAsrHealthRefreshResult = undefined;
}

export type AsrHealthCatalogHooks = {
  syncFromHealth: (healthJson: unknown, rootJson?: unknown) => void;
  refreshIfNeeded: (healthJson: unknown) => void;
};

type Params = {
  tauriRuntime: boolean;
  catalogHooksRef: MutableRefObject<AsrHealthCatalogHooks>;
};

export function useAsrHealthPoll({ tauriRuntime, catalogHooksRef }: Params) {
  const [asrHealth, setAsrHealth] = useState<AsrHealthState>("checking");
  const [asrHealthDetail, setAsrHealthDetail] = useState("");
  const [bundledAsrDiag, setBundledAsrDiag] = useState<p1.BundledAsrLaunchReport | null>(null);
  const [asrCaps, setAsrCaps] = useState<AsrHealthCapabilities | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);

  const refreshBundledAsrDiag = useCallback(async () => {
    try {
      const r = await p1.bundledAsrLaunchReport();
      setBundledAsrDiag(r);
    } catch {
      setBundledAsrDiag(null);
    }
  }, []);

  const refreshAsrHealth = useCallback(
    async (options?: AsrHealthRefreshOptions): Promise<void> => {
      if (inflightRef.current) {
        return inflightRef.current;
      }
      const touchUi = options?.touchUi !== false;

      const run = async (): Promise<void> => {
        if (!tauriRuntime) {
          const detail =
            "浏览器预览环境不自动检测本机 ASR。请在 Tauri 桌面壳中验证本地 ASR 连通性。";
          setAsrHealth("ok");
          setAsrHealthDetail(detail);
          setAsrCaps(null);
          setBundledAsrDiag(null);
          lastAsrHealthRefreshResult = {
            health: "ok",
            healthDetail: detail,
            caps: null,
            healthJson: null,
            rootJson: null,
          };
          return;
        }
        if (touchUi) {
          setAsrHealth("checking");
          setAsrHealthDetail("");
        }
        const url = asrHealthUrl();
        try {
          const res = await loopbackFetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
          if (res.ok) {
            let data: unknown;
            try {
              data = await res.json();
            } catch {
              data = null;
            }
            const parsed = parseAsrHealthJson(data);
            if (!parsed) {
              const detail = `无法解析 ${url} 的能力字段（响应格式不符合 rushi-asr /health 契约）。`;
              setAsrHealth("error");
              setAsrHealthDetail(detail);
              await refreshBundledAsrDiag();
              lastAsrHealthRefreshResult = {
                health: "error",
                healthDetail: detail,
                caps: null,
                healthJson: data,
                rootJson: null,
              };
              return;
            }
            setAsrCaps(parsed);
            let rootJson: unknown = null;
            try {
              const rootRes = await loopbackFetch(`${asrBaseUrl()}/`, {
                signal: AbortSignal.timeout(5000),
              });
              if (rootRes.ok) rootJson = await rootRes.json();
            } catch {
              /* ignore */
            }
            catalogHooksRef.current.syncFromHealth(data, rootJson);
            if (!parseCatalogStatusFromHealth(data)) {
              catalogHooksRef.current.refreshIfNeeded(data);
            }
            setAsrHealth("ok");
            await refreshBundledAsrDiag();
            lastAsrHealthRefreshResult = {
              health: "ok",
              healthDetail: "",
              caps: parsed,
              healthJson: data,
              rootJson,
            };
            return;
          }
          const detail = `无法访问 ${url}（HTTP ${res.status}）。请先在本机启动 ASR：见说明中「启动本地 ASR」一节。`;
          setAsrHealth("error");
          setAsrHealthDetail(detail);
          await refreshBundledAsrDiag();
          lastAsrHealthRefreshResult = {
            health: "error",
            healthDetail: detail,
            caps: null,
            healthJson: null,
            rootJson: null,
          };
          return;
        } catch (e) {
          setAsrHealth("error");
          const msg = e instanceof Error ? e.message : String(e);
          const detail = `无法连接 ${url}：${msg}`;
          setAsrHealthDetail(detail);
          await refreshBundledAsrDiag();
          lastAsrHealthRefreshResult = {
            health: "error",
            healthDetail: detail,
            caps: null,
            healthJson: null,
            rootJson: null,
          };
        }
      };

      inflightRef.current = run().finally(() => {
        inflightRef.current = null;
      });
      return inflightRef.current;
    },
    [catalogHooksRef, refreshBundledAsrDiag, tauriRuntime],
  );

  return {
    asrHealth,
    asrHealthDetail,
    bundledAsrDiag,
    asrCaps,
    refreshAsrHealth,
    refreshBundledAsrDiag,
  };
}

import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { asrBaseUrl, asrHealthUrl } from "../config/env";
import type { AsrHealthCapabilities } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { parseCatalogStatusFromHealth } from "../services/asr/localAsrModelCatalog";
import { loopbackFetch } from "../services/asr/loopbackFetch";
import { parseAsrHealthJson } from "../services/asr/asrHealthParse";
import { waitMinVisibleBusy } from "../services/ui/minVisibleBusy";

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

/** 后台 health 失败时保留上次 ok 快照，避免侧车推理忙导致顶栏误报未就绪。 */
export function shouldSkipAsrHealthDowngrade(
  touchUi: boolean,
  result: Pick<AsrHealthRefreshResult, "health">,
  lastGood: AsrHealthRefreshResult | null,
): boolean {
  if (touchUi) return false;
  if (result.health === "ok") return false;
  return lastGood?.health === "ok" && lastGood.caps != null;
}

let lastAsrHealthRefreshResult: AsrHealthRefreshResult | undefined;

export function getLastAsrHealthRefreshResult(): AsrHealthRefreshResult | undefined {
  return lastAsrHealthRefreshResult;
}

type AsrHealthCatalogHooks = {
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
  const lastGoodRef = useRef<AsrHealthRefreshResult | null>(null);

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
        const startedAt = Date.now();
        if (touchUi) {
          setAsrHealth("checking");
          setAsrHealthDetail("");
        }

        const commit = async (result: AsrHealthRefreshResult, caps: AsrHealthCapabilities | null) => {
          if (shouldSkipAsrHealthDowngrade(touchUi, result, lastGoodRef.current)) {
            return;
          }
          if (touchUi) await waitMinVisibleBusy(startedAt);
          setAsrHealth(result.health);
          setAsrHealthDetail(result.healthDetail);
          setAsrCaps(caps);
          lastAsrHealthRefreshResult = result;
          if (result.health === "ok" && caps) {
            lastGoodRef.current = result;
          }
        };

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
              await refreshBundledAsrDiag();
              await commit(
                {
                  health: "error",
                  healthDetail: detail,
                  caps: null,
                  healthJson: data,
                  rootJson: null,
                },
                null,
              );
              return;
            }
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
            await refreshBundledAsrDiag();
            await commit(
              {
                health: "ok",
                healthDetail: "",
                caps: parsed,
                healthJson: data,
                rootJson,
              },
              parsed,
            );
            return;
          }
          const detail = `无法访问 ${url}（HTTP ${res.status}）。请先在本机启动 ASR：见说明中「启动本地 ASR」一节。`;
          await refreshBundledAsrDiag();
          await commit(
            {
              health: "error",
              healthDetail: detail,
              caps: null,
              healthJson: null,
              rootJson: null,
            },
            null,
          );
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const detail = `无法连接 ${url}：${msg}`;
          await refreshBundledAsrDiag();
          await commit(
            {
              health: "error",
              healthDetail: detail,
              caps: null,
              healthJson: null,
              rootJson: null,
            },
            null,
          );
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

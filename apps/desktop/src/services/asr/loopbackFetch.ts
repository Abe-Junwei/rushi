import { invoke } from "@tauri-apps/api/core";
import { asrBaseUrl, isTauriRuntime } from "../../config/env";
import {
  loopbackInvokeMissingCommandDev,
  loopbackInvokeMissingCommandManaged,
  packagedOrDev,
} from "../packagedUserHints";

type LoopbackInvokeBody = {
  path: string;
  method?: string;
  body?: unknown;
  port?: number;
  timeoutMs?: number;
};

type LoopbackInvokeResult = {
  status: number;
  body: unknown;
};

export type LoopbackFetchInit = RequestInit & {
  /** Rust reqwest timeout; defaults from path/method when omitted. */
  loopbackTimeoutMs?: number;
};

/** Port from configured ASR base URL when loopback-only; else default 8741. */
function asrLoopbackPort(): number {
  try {
    const u = new URL(asrBaseUrl());
    if (u.protocol !== "http:") return 8741;
    const host = u.hostname;
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") return 8741;
    if (u.port) {
      const n = Number(u.port);
      return Number.isFinite(n) && n > 0 ? n : 8741;
    }
    return 8741;
  } catch {
    return 8741;
  }
}

/** WebView fetch to loopback often fails ("Load failed"); Rust reqwest uses 127.0.0.1 (ASR bind addr). */
function canUseTauriLoopbackProxy(): boolean {
  if (!isTauriRuntime()) return false;
  try {
    const u = new URL(asrBaseUrl());
    if (u.protocol !== "http:") return false;
    const host = u.hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

function pathFromUrl(url: string): string {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
}

/** Default Rust-side timeouts (AbortSignal.timeout does not cancel Tauri invoke). */
export function defaultLoopbackTimeoutMs(method: string, path: string): number {
  const m = method.toUpperCase();
  if (path.includes("/v1/models/prepare") && m === "POST") return 900_000;
  if (m === "GET" && (path === "/health" || path === "/" || path.includes("/prepare-status") || path.includes("/transcribe/status"))) {
    return 8_000;
  }
  if (m === "GET") return 15_000;
  return 60_000;
}

function formatLoopbackInvokeError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    /asr_loopback_request/i.test(msg) &&
    (/not found/i.test(msg) || /unknown command/i.test(msg) || /Invalid args/i.test(msg))
  ) {
    return `${msg}。${packagedOrDev(loopbackInvokeMissingCommandDev, loopbackInvokeMissingCommandManaged)}`;
  }
  return msg;
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new DOMException("The operation timed out.", "TimeoutError")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

async function loopbackInvoke(
  path: string,
  method: string,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<LoopbackInvokeResult> {
  const raw = invoke<LoopbackInvokeResult>("asr_loopback_request", {
    path,
    method,
    body: body ?? null,
    port: asrLoopbackPort(),
    timeoutMs,
  } satisfies LoopbackInvokeBody);
  return raceWithAbort(raceWithTimeout(raw, timeoutMs), signal);
}

/** Drop-in for `fetch` to the local ASR service (JSON bodies only). */
export async function loopbackFetch(url: string, init?: LoopbackFetchInit): Promise<Response> {
  if (!canUseTauriLoopbackProxy()) {
    return fetch(url, init);
  }
  const path = pathFromUrl(url);
  const method = (init?.method ?? "GET").toUpperCase();
  const timeoutMs = init?.loopbackTimeoutMs ?? defaultLoopbackTimeoutMs(method, path);
  let bodyJson: unknown;
  if (init?.body != null) {
    if (typeof init.body === "string") {
      bodyJson = JSON.parse(init.body) as unknown;
    } else {
      throw new Error("loopbackFetch only supports string JSON bodies");
    }
  }
  try {
    const out = await loopbackInvoke(path, method, bodyJson, timeoutMs, init?.signal ?? undefined);
    return new Response(JSON.stringify(out.body), {
      status: out.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    throw new Error(formatLoopbackInvokeError(e));
  }
}

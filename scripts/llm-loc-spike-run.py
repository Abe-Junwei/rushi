#!/usr/bin/env python3
"""LLM-LOC-SPIKE: R3t-C (auto_punctuate) eval — cloud vs Ollama loopback."""
from __future__ import annotations

import argparse
import http.client
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "fixtures/llm-loc-eval/eval_manifest.v1.json"
OUT_DIR = ROOT / "docs/execution/spike-output"
DEFAULT_APP_DATA = Path.home() / (
    "Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi"
)
DEFAULT_KEY_FILE = DEFAULT_APP_DATA / "secrets/postprocess/default.key"


def resolve_cloud_api_key() -> str | None:
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if key:
        return key
    key_file = Path(
        os.environ.get("RUSHI_LLM_KEY_FILE", str(DEFAULT_KEY_FILE))
    )
    if key_file.is_file():
        return key_file.read_text(encoding="utf-8").strip() or None
    return None

SYSTEM = (
    "你是中文转写后处理助手。只给当前语段补充自然、克制的中文标点，"
    "不改写词语，不补充解释，不输出 markdown，不返回额外说明。"
)


def build_prompt(text: str) -> str:
    lines = [
        "任务：仅为“当前语段”补充自然中文标点。",
        "约束：",
        "1. 不改写词语，不补充省略内容。",
        "2. 不输出解释，不加引号标题。",
        "3. 仅返回处理后的当前语段正文。",
        "当前语段：",
        text.strip(),
    ]
    return "\n".join(lines)


def chat_completion(
    *,
    endpoint: str,
    model: str,
    api_key: str | None,
    prompt: str,
    timeout_s: int,
) -> tuple[str, int]:
    body = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ],
    }
    data = json.dumps(body).encode("utf-8")
    url = endpoint.rstrip("/") + "/chat/completions"
    parsed = urlparse(url if "://" in url else f"http://{url}")
    path = parsed.path or "/v1/chat/completions"
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    headers = {"Content-Type": "application/json", "Connection": "close"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    t0 = time.perf_counter()
    if parsed.scheme == "https":
        conn = http.client.HTTPSConnection(host, port, timeout=timeout_s)
    else:
        conn = http.client.HTTPConnection(host, port, timeout=timeout_s)
    try:
        conn.request("POST", path, body=data, headers=headers)
        resp = conn.getresponse()
        raw = resp.read().decode("utf-8")
        if resp.status >= 400:
            raise RuntimeError(f"HTTP {resp.status}: {raw[:200]}")
        payload = json.loads(raw)
    finally:
        conn.close()
    latency_ms = int((time.perf_counter() - t0) * 1000)
    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError("missing choices")
    content = (choices[0].get("message") or {}).get("content")
    if isinstance(content, str):
        out = content.strip()
    elif isinstance(content, list):
        out = "".join(
            p.get("text", "") for p in content if isinstance(p, dict)
        ).strip()
    else:
        raise RuntimeError("missing message.content")
    return out, latency_ms


def load_manifest(path: Path, limit: int | None) -> list[dict]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    items = doc.get("items") or []
    if limit is not None:
        items = items[:limit]
    return items


def run_provider(
    *,
    label: str,
    endpoint: str,
    model: str,
    api_key: str | None,
    items: list[dict],
    timeout_s: int,
) -> dict:
    results = []
    errors = 0
    latencies: list[int] = []
    for it in items:
        text = (it.get("segment_text") or "").strip()
        if not text:
            continue
        row = {
            "id": it.get("id"),
            "segment_uid": it.get("segment_uid"),
            "input": text,
        }
        try:
            out, ms = chat_completion(
                endpoint=endpoint,
                model=model,
                api_key=api_key,
                prompt=build_prompt(text),
                timeout_s=timeout_s,
            )
            row["output"] = out
            row["latency_ms"] = ms
            latencies.append(ms)
        except Exception as e:
            row["error"] = f"{type(e).__name__}: {e}"
            errors += 1
        results.append(row)
    latencies.sort()
    p95 = latencies[int(len(latencies) * 0.95) - 1] if latencies else None
    return {
        "label": label,
        "endpoint": endpoint,
        "model": model,
        "ran_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "task": "r3t-c-auto_punctuate",
        "count": len(results),
        "errors": errors,
        "latency_ms_p50": latencies[len(latencies) // 2] if latencies else None,
        "latency_ms_p95": p95,
        "items": results,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", choices=("cloud", "ollama"), required=True)
    ap.add_argument("--manifest", type=Path, default=MANIFEST)
    ap.add_argument("--limit", type=int, default=None, help="cap items for dry-run")
    ap.add_argument("--timeout", type=int, default=120)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--model", default=None)
    args = ap.parse_args()

    if not args.manifest.is_file():
        print(f"Missing manifest: {args.manifest}", file=sys.stderr)
        return 1

    items = load_manifest(args.manifest, args.limit)
    if len(items) < 1:
        print("No eval items", file=sys.stderr)
        return 1

    if args.provider == "cloud":
        api_key = resolve_cloud_api_key()
        if not api_key:
            print(
                "Set DEEPSEEK_API_KEY or store key in App Data secrets/postprocess/default.key",
                file=sys.stderr,
            )
            return 1
        endpoint = os.environ.get(
            "DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"
        )
        model = args.model or os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
        label = "baseline-cloud-deepseek"
    else:
        api_key = None
        base = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
        endpoint = f"{base}/v1"
        model = args.model or os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
        label = f"ollama-{model.replace(':', '-')}"

    doc = run_provider(
        label=label,
        endpoint=endpoint,
        model=model,
        api_key=api_key,
        items=items,
        timeout_s=args.timeout,
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = args.out or (
        OUT_DIR / f"llm-loc-{label}-{doc['ran_at'][:10]}.json"
    )
    out_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} ({doc['count']} items, errors={doc['errors']}, p95={doc['latency_ms_p95']}ms)")
    return 0 if doc["errors"] == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())

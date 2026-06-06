# 轮次 2 审查报告：转写链路

## 审查范围

**前端**：`useTranscribeJobController.ts`, `services/asr/`, `components/envLocalAsr/`

**Rust 后端**：`run_transcribe_cmd.rs`, `transcribe.rs`, `transcribe_job.rs`, `transcribe_timeout.rs`, `asr_sidecar/candidates.rs`, `asr_sidecar/probe.rs`, `asr_sidecar/source.rs`

**Python ASR**：`funasr_engine.py`, `transcribe_job.py`, `transcribe_windows.py`

**测试**：cargo test asr_sidecar 17 passed ✅ | r3h-0 machine gate ✅ | vitest 908 passed ✅

---

## 缺陷清单

### P1 — 高优先级

#### 2.1 `reqwest::blocking` 阻塞 Tauri 线程池
**位置**：
- `asr_sidecar/probe.rs`
- `asr_sidecar/source.rs`
- `postprocess_ollama.rs`
- `postprocess_probe.rs`
- `stt_online_probe.rs`

**问题**：这些文件在 Rust async Tauri command 的调用链中使用 `reqwest::blocking`。Tauri v2 的 async runtime 线程池有限（默认 ~512），blocking HTTP 会占用线程直到请求完成。在高延迟场景（Ollama 本地模型冷启动、STT 健康探测超时）下，可能导致线程池耗尽，其他 async command 无法执行。

**修复建议**：全部改为 `reqwest` async client，或使用 `tauri::async_runtime::spawn_blocking` 包裹。

#### 2.2 `run_transcribe_cmd.rs` 功能混杂，接近拆分阈值
**位置**：`apps/desktop/src-tauri/src/project/run_transcribe_cmd.rs` — 463 行

虽然未超过 500 行，但一个文件同时处理：本地 FunASR、OpenAI、AssemblyAI、百度/阿里/讯飞/火山等 10+ 个国内厂商、通用在线 multipart。任何 provider 的修改都需要修改此文件，冲突风险高。

**修复建议**：按 provider 拆分为 `run_transcribe_local.rs`、`run_transcribe_openai.rs`、`run_transcribe_online.rs`。

#### 2.3 `useTranscribeJobController.ts` 超阈值
**位置**：`apps/desktop/src/pages/useTranscribeJobController.ts` — 367 行，13 个 hook

AGENTS.md：hook > 300 行 / > 12 hooks 应拆分。

---

### P2 — 中优先级

#### 2.4 `transcribe.rs` 功能混杂
**位置**：`apps/desktop/src-tauri/src/project/transcribe.rs` — 291 行

同时包含：
- `post_transcribe_multipart`（本地+通用在线共用）
- `openai_verbose_json_to_rushi`（OpenAI 响应转换）
- `assemblyai_transcript_json_to_rushi`（AssemblyAI 响应转换）
- `assemblyai_words_to_segments`

**修复建议**：拆分为 `transcribe_multipart.rs`、`transcribe_openai.rs`、`transcribe_assemblyai.rs`。

#### 2.5 窗口切分后时间戳可能重叠
**位置**：`services/asr/rushi_asr/transcribe_windows.py:101-108`

```python
def sort_window_segments(segments: list[TranscriptionSegment]) -> list[TranscriptionSegment]:
    """Sort window slices by time; overlap trimming is done in the Rust desktop layer."""
    return sorted(segments, key=lambda s: (s.start_sec, s.end_sec))
```

注释说"overlap trimming is done in the Rust desktop layer"，但如果 Rust 层的 `sanitize_segments_for_media` + `trim_adjacent_segment_overlaps` 没有正确执行，窗口边界处的语段会有时间重叠。

**验证状态**：需要检查 Rust 层 `segment_media_sanitize.rs` 的 overlap trimming 对跨窗口边界的处理。

#### 2.6 `transcribe_job.py` 的 `_jobs` 字典无持久化
**位置**：`services/asr/rushi_asr/transcribe_job.py:19`

```python
_jobs: dict[str, "_JobRecord"] = {}
```

如果 sidecar 进程重启（崩溃、被用户杀掉），所有进行中的 async 转写任务丢失。前端 poll 时会收到 `phase: "unknown"`。

**分析**：这是设计权衡。sidecar 作为轻量 HTTP 服务，不维护持久状态。崩溃后由前端重新发起转写。可接受，但应在文档中明确。

#### 2.7 Python `ThreadPoolExecutor.shutdown(wait=False, cancel_futures=True)` 的兼容性
**位置**：`services/asr/rushi_asr/funasr_engine.py:77`

```python
old.shutdown(wait=False, cancel_futures=True)
```

`cancel_futures=True` 是 Python 3.9+ 的参数。项目 `pyproject.toml` 要求 Python ≥3.11，所以没问题。但如果用户系统有 Python 3.8，会报错。由于 PyInstaller 打包了 Python 3.12 运行时，此风险可控。

---

### P3 — 低优先级

#### 2.8 `funasr_engine.py` 中 `_warn` 闭包重复定义
`generate_and_parse_funasr` 和 `transcribe_by_windows` 中都定义了局部 `_warn` 函数。可以提取为模块级工具函数。

#### 2.9 `postprocess_lexicon_ops.rs` 735 行 — 远超阈值
架构守卫已警告。

---

## 动态模拟结果

| 测试 | 结果 | 备注 |
|------|------|------|
| cargo test asr_sidecar | ✅ 17 passed | — |
| r3h-0 machine gate | ✅ passed | smoke + asr_setup + pip UI + arch guard |
| vitest | ✅ 908 passed | — |
| 架构守卫 | ⚠️ 43 warnings | 无 error |

---

## 修复优先级

| 优先级 | 事项 | 文件 |
|--------|------|------|
| P1 | `reqwest::blocking` → async | `probe.rs`, `source.rs`, `postprocess_*.rs`, `stt_online_probe.rs` |
| P1 | 拆分 `useTranscribeJobController.ts` | `useTranscribeJobController.ts` |
| P2 | 拆分 `run_transcribe_cmd.rs` | `run_transcribe_cmd.rs` |
| P2 | 拆分 `transcribe.rs` | `transcribe.rs` |
| P2 | 验证窗口切分 overlap trimming | `segment_media_sanitize.rs` + `transcribe_windows.py` |
| P3 | 拆分 `postprocess_lexicon_ops.rs` | `postprocess_lexicon_ops.rs` |

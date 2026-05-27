# Acceptance: R3e — 长音频本机转写（超时 / 内存 / 分段）

> **状态**：**R3e-A 已编码**（动态超时、失败分类、长音频提示、侧车 ffmpeg 超时对齐）；**R3e-B 分段转写仍待实施**。R3e-A 手测（含 50min）待签收。  
> **关联**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §R3e、[`../../architecture/asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)、[`../../architecture/asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md)

## 背景（手测现象）

用户在开发调试下对 **约 50 分钟** 中文音频执行「拉取语段 / 本机 ASR」时出现：

1. **一次内存不足** — FunASR 整文件推理导致 `rushi-asr` 进程被系统终止或 OOM。
2. **一次 `ASR 请求失败: error sending request for url (http://127.0.0.1:8741/v1/transcribe)`** — 常见于 ASR 已崩溃，或桌面端 HTTP 超时断开而侧车仍在算。

当前链路（代码真源）：

```text
桌面 project_run_transcribe
  → POST /v1/transcribe（multipart 整文件）
  → rushi-asr: ffmpeg 转 16k mono WAV（timeout 600s）
  → FunASR model.generate(整文件)（无分段）
```

硬限制摘录：

| 位置 | 当前值 | 对 50min 的影响 |
|------|--------|-----------------|
| `run_transcribe_cmd.rs` 本机 ASR 请求 | **固定 600s** | CPU 推理常需 >>10min，客户端先超时 |
| `ffmpeg_audio.normalize_to_wav_16k_mono` | **600s** | 极长/重编码源可能不够 |
| `funasr_engine` | **整文件一次 generate** | 内存随时长上升，易 OOM |
| `app.py` 上传上限 | 512MB | 50min 16k WAV 通常可过，非主因 |

## 目标

让 **30～60 分钟级** 本机 FunASR 转写在产品上**可预期、可诊断、可完成**（与 R9 REL-1 长音频手测对齐），分两档交付：

- **R3e-A（快修）**：超时与错误可观测 + 用户可见说明，不承诺 50min 一次成功但不再「静默失败」。
- **R3e-B（正解）**：按时长/VAD **分段转写 + 时间轴合并**，控制峰值内存并在合理时间内完成。

> **硬门禁（Q-R3e-1）**：**R3e-A 不能作为长音频多段质量验收依据**。50min 手测仅验证：动态超时、失败分类、OOM/断连文案；**≥10min 多语段** 验收归属 **R3t-A + R3e-B**。

## 范围

### R3e-A — 快修（建议 0.5～1 周）

| 做 | 说明 |
|----|------|
| 本机转写超时策略 | 桌面 `post_transcribe_multipart` 超时由固定 600s 改为 **按音频时长推导**（下限 600s，上限如 7200s，可配置常量） |
| ffmpeg 超时对齐 | `rushi_asr` 规范化超时与时长挂钩或提高到与转写一致 |
| 失败文案 | 区分：连接断开 / HTTP 超时 / ASR 进程无响应 / payload 内 `funasr_*` 错误 |
| 环境页提示 | `EnvLocalAsrPanel` 或转写前横幅：>30min 建议分段、关闭占内存应用、`RUSHI_FUNASR_DEVICE=mps`（Apple Silicon） |
| 日志 | `desktop.log` 记录音频时长、选用 timeout、ASR 连接错误原文 |

| 不做 | |
|------|--|
| 自动分段合并 | 留给 R3e-B |
| 异步任务队列 UI | 留给 R3e-B 或更后 |

**验收（R3e-A）**：

- [ ] 对 50min 文件，桌面等待时间 ≥ 原 600s（不再 10min 必断）；`desktop.log` 含 `timeout_s=7200`（或按时长推导值）— 长音频仍 OOM，此项待 R3e-B 后复测
- [x] 若 ASR 进程被杀，错误文案提示侧车崩溃/内存而非笼统 `error sending request`（2026-05-27 手测）
- [x] 短音频回归 ≤10min 仍一次完成（2026-05-27 手测）
- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`（实施提交时跑通）
- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`（`transcribe_timeout` / `transcribe_errors` 单测）

### R3e-B — 分段转写（建议 1～1.5 周，依赖 R3e-A）

| 做 | 说明 |
|----|------|
| 分段策略 | 默认按 **固定时长窗口**（如 5～10min）或 VAD 静音切分（二选一，spec 实施时定） |
| ASR 侧 | 新内部路径或 `POST /v1/transcribe` 可选 `chunked=true`：逐段 ffmpeg+FunASR，合并 `sentence_info` 并 **偏移 start/end** |
| 桌面侧 | `project_run_transcribe` 对超长音频走分段 API，或循环调用并合并语段（优先单命令、原子写库） |
| 进度 | 长任务返回阶段（规范化 / 段 N/M / 合并）供 UI 展示（最小：日志 + busy 文案） |
| 热词 | 各段携带同一 `hotwords`；合并后 idx 连续 |

| 不做 | |
|------|--|
| 断点续传跨重启 | T-004 另项 |
| 在线 STT 长音频 | 本薄片仅 **本机 FunASR** |

**验收（R3e-B）**：

- [ ] 手测 **30～60min** 中文音频：本机转写完成，语段时间轴连续、可编辑保存
- [ ] 峰值内存显著低于整文件一次推理（实施时记录一次 Activity Monitor 快照到验收备注）
- [ ] 硬闸门全绿

## 非功能约束

- 分段合并后语段 `start_sec` / `end_sec` 单调、不重叠（允许间隙）。
- 单段失败时：整次转写失败并保留已下载 WAV 缓存；**不**写半成品语段进 DB（除非显式产品决策）。
- 仍遵守 loopback ASR、不上传密钥、不扩大 SSRF 面。
- Apple Silicon 优先文档化 `RUSHI_FUNASR_DEVICE=mps`；不强制 CUDA。

## 落位文件（实施时）

| 层 | R3e-A | R3e-B |
|----|-------|-------|
| Rust | `run_transcribe_cmd.rs`、`transcribe.rs` | 同上 + 可选 `transcribe_chunked.rs` |
| Python | `ffmpeg_audio.py`、`app.py` | `engine.py`、`funasr_engine.py` 或 `transcribe_chunked.py` |
| UI | `asrTranscribeHints.ts`、`EnvLocalAsrPanel` 或转写 busy 文案 | `useProjectLifecycleController` / 进度文案 |
| 测试 | 超时推导单测 | 分段合并单测 + 短样本集成 |

## 手测清单（与 R9 对齐）

### A. 50min 本机转写（R3e-B 完成后）

1. ASR `/health` 为 `funasr` + `funasr_default_model_cached: true`。
2. 打开含 50min 音频的项目，执行拉取语段。
3. 等待至完成或明确失败（有阶段/超时说明）。
4. 检查语段数量、时间轴覆盖、正文非空。
5. 保存 → 重启应用 → 语段仍在。

### B. 回归短音频（≤10min）

1. 短音频转写仍一次完成，延迟不明显变差。

### C. 失败可诊断（R3e-A 起）

1. 故意停掉 `python -m rushi_asr` 再转写 → 中文提示检查 ASR 服务。
2. `desktop.log` 有 `transcribe connect` 记录。

## 手测记录

| 日期 | 场景 | 结果 | 备注 |
|------|------|------|------|
| 2026-05-25 | 50min 整文件 | ❌ OOM + request failed | 触发本 spec |
| 2026-05-27 | ≤10min 本机转写（`desktop:dev`） | ✅ 通过 | R3e-A 回归；语段可落库 |
| 2026-05-27 | 50min 整文件（`desktop:dev`） | ❌ 侧车崩溃 | R3e-A 新文案：「侧车可能已崩溃…内存不足」；超时延长仍无法避免 OOM，待 R3e-B |

## 完成定义

- [x] R3e-A 实施并通过「短音频回归 + 失败可诊断」签收（长音频完整能力仍依赖 R3e-B）
- [ ] R3e-B 分段转写 + 30～60min 主路径手测
- [ ] R9 REL-1 长音频项可勾选（依赖 R3e-B）
- [x] 路线图 §4.1 下一刀：R3g-A（macOS 安装包 / 50min 完整转写延后）

## 实施顺序建议

```text
R3d 设置 IA
  → R3e-A 超时与诊断（ unblock 部分长音频）
  → R3e-B 分段转写（30～60min 主路径）
  → R4 / R9
```

若发版日期紧，可 **只交付 R3e-A** 并在 R9 手测中标注「长音频需外部分段」，但 REL-1 完整勾选依赖 R3e-B。

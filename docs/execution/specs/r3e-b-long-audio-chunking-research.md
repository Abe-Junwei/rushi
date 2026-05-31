# 调研：R3e-B — 长音频本机转写（分片 / 进度 / 内存）

> **状态**：**编码 ✅ · 手测签收 ✅**（2026-05-30）；见 [`r3e-b-hand-test-checklist.md`](./r3e-b-hand-test-checklist.md)  
> **关联**：[`r3e-long-audio-transcribe-acceptance.md`](./r3e-long-audio-transcribe-acceptance.md)、[`recording-transcribe-llm-refine-plan.md`](./recording-transcribe-llm-refine-plan.md) §2.3、[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §1.7 **Q2**  
> **门禁**：本文 §6 签收前不得实施 R3e-B 业务代码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 30～60min 中文会议/录音在本机 FunASR（Paraformer / SenseVoice）转写；需多语段、时间轴可编辑、可保存 |
| **失败现象** | 2026-05-25/27 手测 50min：`rushi-asr` **OOM 被杀**；R3e-A 延长 HTTP/ffmpeg 超时后仍崩溃，错误文案已改善 |
| **根因（代码）** | 侧车 `funasr_engine.transcribe_with_funasr` 对 **整轨 normalized.wav** 单次 `AutoModel.generate()`；R3t-A 只解决 **结果解析/分段模式**，未降低 **推理峰值内存** |
| **本仓已有** | `segmentation.py`（R3t-A 分段内核）；`asr_model_profile.py`（SKU+时长 kwargs）；R3e-A 动态超时（Rust）；`transcribe_stage=*` 日志 |
| **成功标准** | 50min 手测完成；`segments[]` 时间单调、可落库；峰值内存显著低于整轨；用户可见「长任务进行中」（至少 busy + 可诊断日志） |

**关键路径（现状）**

```text
桌面 project_run_transcribe（单次 HTTP，blocking）
  → POST /v1/transcribe（multipart 整文件）
  → engine.transcribe_upload → ffmpeg 整轨 16k mono
  → funasr_engine.transcribe_with_funasr（整轨 generate 一次）
  → segment_funasr_generate_result（R3t-A）
  → 桌面 parse → save（原子写库）
```

---

## 2. 业内成熟路线

### A. FunASR 官方：VAD + 动态 batch（单请求内长音频）

| 项 | 内容 |
|----|------|
| **代表** | [FunASR 教程](https://modelscope.github.io/FunASR/zh/tutorial.html)、[tutorial README_zh](https://github.com/modelscope/FunASR/blob/main/docs/tutorial/README_zh.md) |
| **机制** | `AutoModel(model=paraformer, vad_model=fsmn-vad, punc_model=ct-punc)` + `generate(input=长音频)`；VAD 切语音段；`batch_size_s` / `batch_size_threshold_s` / `vad_kwargs.max_single_segment_time` 控内存 |
| **与本仓关系** | **已部分采用**：侧车已挂 `vad_model`、`max_single_segment_time=30000ms`（`RUSHI_FUNASR_VAD_MAX_MS`）；Paraformer 长音频 profile 有 `sentence_timestamp` + `merge_vad=False`，但 **未设** `batch_size_s` / `batch_size_threshold_s`（SenseVoice 仅有 `batch_size_s=60`） |
| **官方 OOM 建议** | ① 减小 `batch_size_s`；② 减小 `batch_size_threshold_s` 强制长段 batch=1；③ 减小 `max_single_segment_time` 缩短 VAD 段 |

### B. Whisper 系：VAD 切块 + 时间戳偏移合并

| 项 | 内容 |
|----|------|
| **代表** | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) `vad_filter` + [collect_chunks](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/vad.py)；[chunk 时间戳连续性说明](https://theneuralbase.com/whisper/learn/intermediate/timestamp-continuity-across-chunks/) |
| **机制** | Silero VAD 得 speech spans → 合并为 ≤N 秒 audio chunk → 逐块 `transcribe` → **每块 start/end += chunk_offset** → 拼接 segments |
| **与本仓关系** | **不替换引擎**（R3g FunASR SKU 已定）；**可复用模式**：窗口循环 + offset 合并 + 单分段解析函数 |

### C. 固定时长文件分片（侧车 / 桌面编排）

| 项 | 内容 |
|----|------|
| **代表** | 云「录音文件识别」分片上传；社区 `faster-whisper-batch-transcriber`；本仓 acceptance 草案「5～10min 窗口」 |
| **机制** | ffmpeg 按 wall-clock 切 WAV（可重叠 0.5～1s 防切词）→ 逐片 ASR → 偏移合并 → 一次返回 `segments[]` |
| **与本仓关系** | 路线图 **Q2**：**侧车内循环**优先；桌面 **不** 多 HTTP 循环（保持单命令原子写库） |

### D. 云长音频异步 Job（仅 UX 参考）

| 项 | 内容 |
|----|------|
| **代表** | [Otter 导入进度 FAQ](https://help.otter.ai/hc/en-us/articles/360048322493)；Descript API `transcription.start` + poll |
| **机制** | 上传 → 后台 Job → 百分比 / 完成通知；桌面本地无云 Job |
| **与本仓关系** | v1 **借鉴**：阶段文案 +「处理中不可编辑」；**不**引入云端队列；可复用侧车已有 **`prepare-status` 轮询模式**（见 §4 进度） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束 | 进度 / 内存 / 运维 |
|------|--------|----------|---------------|-------------------|
| **A FunASR 调参** | **高** | `asr_model_profile.build_generate_kwargs` 扩展；FunASR 文档参数 | 符合 Q-ACC「用户不填 merge_vad」；Profile 内默认 | 内存↓可能足够 **≤30min**；50min 仍可能 OOM；**无段 N/M** |
| **A+B 侧车窗口循环** | **高** | `ffmpeg_audio` 切片；`segment_funasr_generate_result` + offset；`engine.transcribe_upload` 编排 | **Q2 侧车内循环**；**禁止**桌面 fork VAD；单 POST 响应形状不变 | 峰值≈单窗口；日志可打 `window i/N` |
| **B Whisper 引擎** | 低 | — | 违背 R3g catalog / 安装体积 / 双引擎维护 | 不采纳 |
| **C 桌面多 HTTP** | 低 | `run_transcribe_cmd` 合并 | 破坏原子性、超时难配、热词重复传 | 不采纳为 v1 |
| **D 云 Job UX** | 中（UX） | `model_prepare_progress` + `GET prepare-status` 模式 | loopback only | v1.5 可选 async transcribe job |

**本仓必须先复用（禁止重写）**

| 模块 | 路径 | R3e-B 用法 |
|------|------|------------|
| 分段解析 | `services/asr/rushi_asr/segmentation.py` | 每窗口 `generate` 结果走 `segment_funasr_generate_result`；别名 `segment_audio_to_transcription_segments` |
| SKU kwargs | `asr_model_profile.py` | 长音频 OOM 参数 + 是否启用窗口循环阈值 |
| 超时 | `transcribe_timeout.rs` / `transcribe_timeouts.py` | 整任务超时 = 按 **总时长** 推导（R3e-A），非 per-window 固定 600s |
| 写库 | `run_transcribe_cmd.rs` | **不改**多段写库语义；仍 `transcribe_stage=preflight→parse→save` |
| 失败文案 | `asrTranscribeHints.ts` / `transcribe_errors.rs` | 扩展 `funasr_window_failed` / `transcribe_partial_oom` 等 |

---

## 4. 决策摘要

### 4.1 总方案（推荐，对齐 Q2）

**两阶段侧车策略（同一 HTTP `/v1/transcribe`）**

```text
transcribe_upload(normalized.wav)
  ├─ duration < WINDOW_THRESHOLD (建议 1800s / 30min)
  │    └─ 现有 transcribe_with_funasr（+ 补强 A 节 FunASR 调参）
  └─ duration ≥ WINDOW_THRESHOLD
       └─ transcribe_by_windows（新模块）
            for i in 1..N:
              ffmpeg 切 [t_i, t_i+WINDOW_SEC)  →  tmp slice.wav
              generate(slice) → segment_funasr_generate_result → offset +t_i
            merge segments → 单次 TranscriptionResult
```

| 参数 | 建议初值 | 依据 |
|------|----------|------|
| `WINDOW_SEC` | **300**（5min） | FunASR OOM 文档 + 50min→10 窗；可 env `RUSHI_FUNASR_WINDOW_SEC` 排障 |
| `WINDOW_THRESHOLD` | **1800**（30min） | 短于 30min 先走调参整轨；≥30min 强制窗口 |
| `WINDOW_OVERLAP_SEC` | **0**（v1） | 简化；边界切词靠 VAD 句界；v1.1 可加 0.5s overlap + trim |
| Paraformer 长音频 kwargs | `batch_size_s=60`, `batch_size_threshold_s=30`, 保持 `max_single_segment_time=30000` | FunASR 官方 OOM 三节 |

### 4.2 分片边界

| 选项 | 决策 |
|------|------|
| 固定 wall-clock 窗口 | **v1 采用**（ffmpeg `-ss/-t`） |
| FunASR 内置 VAD  alone | **整轨路径保留**（<30min）；长轨 **窗口内**仍用 VAD+ASR |
| 桌面 HTTP 分片 | **不做** v1 |

### 4.3 执行位置

| 选项 | 决策 |
|------|------|
| 侧车内循环 | **是** — 新 `transcribe_windows.py`（或 `funasr_engine.transcribe_long_by_windows`） |
| 桌面多请求 | **否** |
| `chunked=true` 新 API | **否** v1 — 行为放进现有 `/v1/transcribe`，避免 Rust 双路径 |

### 4.4 进度

| 层级 | v1（R3e-B 最小） | v1.5（可选同 PR 或跟进） |
|------|------------------|-------------------------|
| 侧车 | `log.info("transcribe_window i=%d n=%d", ...)` | `TranscribeProgressTracker` + `GET /v1/transcribe-status`（仿 `prepare-status`） |
| 桌面 | `ProjectStatusFeedback` busy 已有；长音频 hint 沿用 R3e-A | 轮询 status → busy 副标题「第 i/N 段」 |
| 日志 | `desktop.log` 仍 `transcribe_stage=*`；侧车日志可 grep window | |

**不做什么（v1）**

- 断点续传跨重启（T-004 / R3h-2 artifact）
- 在线 STT 长音频
- 第二套 VAD / 分段解析
- 切换 Whisper / faster-whisper 引擎
- 半成品语段写 DB（单窗失败 = 整次失败）

---

## 5. 落位预告（Plan 输入）

| 层 | 文件 | 变更 |
|----|------|------|
| Python | `services/asr/rushi_asr/transcribe_windows.py` **新** | 窗口切分、循环 generate、offset 合并、进度 log |
| Python | `asr_model_profile.py` | Paraformer 长音频 `batch_size_s` / `batch_size_threshold_s` |
| Python | `funasr_engine.py` | 阈值分支：整轨 vs 委托 `transcribe_windows` |
| Python | `engine.py` | 透传 `segmentation_mode` / warnings（如 `transcribe_windowed`） |
| Python | `ffmpeg_audio.py` | `extract_wav_segment(src, dst, start_sec, duration_sec)` |
| Python | `tests/test_transcribe_windows.py` **新** | offset 合并、空窗、失败传播 |
| Rust | `run_transcribe_cmd.rs` | **尽量不改**；可选解析新 warning |
| UI | `ProjectStatusFeedback.tsx` / hints | 长音频 busy 副文案（若 v1.5 无 poll 则仅 hint） |
| 文档 | `r3e-long-audio-transcribe-acceptance.md` | 按本文更新 R3e-B 表 |

**验证**

```bash
pytest services/asr/tests/test_transcribe_windows.py services/asr/tests/test_funasr_engine.py
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml transcribe_timeout
# 手测：50min Paraformer → 完成 + Activity Monitor 峰值记录
bash scripts/r3e-b-hand-test.sh  # 编码阶段新增
```

---

## 6. 签收

| 项 | 状态 |
|----|------|
| §2 业内对照（≥2 条，含链接） | ✅ |
| §3 可复用表 + §4 决策 | ✅ |
| acceptance / plan 链接本文 | ✅（见下） |
| **调研签收** | ✅ **2026-05-30** |
| **编码开工** | ✅ 2026-05-30（`transcribe_windows.py` + Profile 调参） |
| **50min 手测签收** | ✅ 2026-05-30（~48.6min / 2918s；desktop.log 61s 完成） |

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-05-30 | 占位 |
| 2026-05-30 | 完整调研：FunASR 调参 + 侧车 5min 窗口循环；对齐 roadmap Q2 |

**3 行日志模板**

```text
改动：R3e-B 调研签收（FunASR 调参 + 侧车窗口循环 + prepare-status 进度可选）
验证：对照 FunASR 教程 OOM 三节 + 本仓 segmentation.py 消费点
下一轮：按 §5 实施 transcribe_windows + 50min 手测
```

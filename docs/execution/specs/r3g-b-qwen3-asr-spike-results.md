# R3g-B — Qwen3-ASR-0.6B Spike 实测记录

> 填表真源：research [§4.1](./r3g-b-qwen3-asr-sku-spike-research.md#41-go--no-go-阈值硬闸门)  
> 手测步骤：[r3g-b-qwen3-asr-spike-hand-test-checklist.md](./r3g-b-qwen3-asr-spike-hand-test-checklist.md)  
> 机器输出：`docs/execution/spike-output/qwen3-2026-06-03/`（`spike-summary.json`、`s1-long-qwen-summary.json`）

## 环境

| 项 | Paraformer 对照 | Qwen3-0.6B |
|----|-----------------|------------|
| 日期 | 2026-06-03 | 2026-06-03 |
| 机器 / 芯片 | Apple M3 Pro，`RUSHI_FUNASR_DEVICE` 默认 cpu | 同左 |
| `funasr` 版本 | 1.3.9（spike 前侧车曾 1.3.1 会报 not registered） | 1.3.9 |
| `torch` 版本 | 2.11.0 | 2.11.0 |
| `qwen-asr` | — | 0.0.6（`pip install`；已写入 `pyproject.toml` extras） |
| `RUSHI_FUNASR_MODEL` | catalog 默认 Paraformer-long-vad-punc | `Qwen/Qwen3-ASR-0.6B` |
| `/health` ready | 是（用户环境 prepare-default 后） | 是 |

**长样本**：无 R3g 13min fixture → 用 `fixtures/eval/samples/制控.mp3`（**~1250s / ~21min**）代替 S1/S2/S3 长音频对照。

**Spike 期间代码修复**（不进 catalog）：`asr_model_profile.funasr_language_for_model` 将 `zh`→`Chinese`；`pyproject` `funasr>=1.3.3` + `qwen-asr`。

## §4.1 Go / No-go 指标

| # | 指标 | Paraformer 实测 | Qwen3 实测 | 通过？ |
|---|------|-----------------|------------|--------|
| G1 | 13min 语段数 ≥10，无 whole_track_fallback | **197** 段，无 fallback（制控 ~21min） | **0** 段，无 fallback | **否** |
| G2 | 20min 语段数 ≥ max(15, 90% baseline) | baseline **197** | **0** | **否** |
| G3 | async 首窗后 ≤60s 见 ≥1 非空段 | — | **未测**（S2 跳过） | — |
| G4 | blocking vs async final 一致 | — | **未测** | — |
| G5 | 制控 `term_hit_rate` ≥ baseline | **0.0** | **N/A**（无段） | **否** |
| G6 | 磁盘增量 ≤2.5GB | — | 整机 models 目录约 **3.8GB**（含 Paraformer/SenseVoice/VAD）；Qwen 权重已缓存 | **未单独签收** |
| G7 | prepare → ready | 是 | prepare-default **ok**；直接 `transcribe_upload` 可加载 Qwen | **是** |
| G8 | 20min wall ≤1.5× Paraformer | **155.5s** wall（制控） | **1012.9s** wall（~6.5×） | **否** |

## 样本备注

### S1 / 长音频（制控 ~21min，代替 13min）

- **Paraformer**：197 段；首段「没关系，」`0.23s`；末 `1233.505s`；wall **155.5s**；warnings 无。  
- **Qwen3**（语言修复后）：**0** 段；`full_text` 空；wall **1012.9s**；engine `funasr+Qwen/Qwen3-ASR-0.6B`。  
- **warnings**：`funasr_language_model_map:'zh'->'Chinese'`；`funasr_long_audio_no_segments`（×2）。  
- **运行时日志**（关键）：`return_time_stamps requires forced_aligner. Skipping timestamps. Initialize with forced_aligner='Qwen/Qwen3-ForcedAligner-0.6B' to enable.` — FunASR 在 VAD 窗内出字但 **无 sentence_info / timestamp**，R3t-A 分段内核无法产出语段。

### S2（20min async）

- **未执行**（G1 已失败，不继续耗 async 对照）。

### S3（制控，首轮 spike 脚本）

- **Paraformer**：197 段，`term_hit_rate` **0.0**（见 `s3-zhikong-paraformer.json`）。  
- **Qwen3**（funasr 1.3.1 / 未装 qwen-asr）：stub，`not registered` — 环境修复后长跑见 S1。

### S4（clear.wav 短样本）

- **Paraformer**：0 段（过短 + `funasr_no_sentence_segments`）。  
- **Qwen3**（修复后）：0 段；engine 正常；`funasr_no_sentence_segments` + 无时间戳提示。

## 结论（选一）

- [ ] **Go** → 起草 `r3g-b-qwen3-asr-sku-intent.md` 并排队 R3g-B 产品化  
- [ ] **Defer** → blocker：  
- [x] **No-go** → 理由：**在现有 Rushi 路径（FunASR `generate` + R3t-A `segmentation.py`，无 ForcedAligner）下，Qwen3-0.6B 长/短音频均无法产出 ≥1 带时间轴语段**；G1/G2/G5/G8 硬闸门失败。与 research §4.2 一致：时间轴需 **Qwen3-ForcedAligner** 另 spike，本薄片不扩 catalog。

**一句话**：Qwen3 推理可跑通且 prepare 就绪，但 **无分句时间戳 → 0 语段**，长音频还 **显著慢于 Paraformer**；维持 **SenseVoice + Paraformer** 双 SKU，关闭 R3g-B Qwen 产品化线直至 ForcedAligner/分段契约 spike。

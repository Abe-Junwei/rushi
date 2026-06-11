# 调研：ASR 生态前四项（Fun-ASR-Nano · Qwen3+Aligner · 说话人分离 · 长音频评测）

> **状态**：规划门禁（2026-06-11）  
> **触发**：paperswithcode.co 已跳转 HF Trending；对照 Rushi 技术栈梳理 **直接相关** 的四条研究/工程线  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8、§L6；[`r3-asr-landscape-2026-05-improvement-backlog.md`](./r3-asr-landscape-2026-05-improvement-backlog.md)  
> **前置专项**：[`r3g-b-qwen3-asr-sku-spike-research.md`](./r3g-b-qwen3-asr-sku-spike-research.md) ❌ No-go · [`r3g-b-align-qwen3-forced-aligner-spike-research.md`](./r3g-b-align-qwen3-forced-aligner-spike-research.md) 📋 待跑  
> **门禁**：本文 **不授权** 改 catalog / 侧车 lock；各子项 spike Go 后另立 intent

---

## 0. 总览

| # | 主题 | 与 Rushi 关系 | 当前结论（2026-06-11） |
|---|------|---------------|------------------------|
| **①** | Fun-ASR 报告 + **Fun-ASR-Nano** 注册与 `sentence_info` 契约 | 同栈 **Paraformer 继任**；Nano 已支持时间戳 + diarization | **Defer 产品化**；先做源码 venv spike，不 bump 侧车 lock |
| **②** | **Qwen3-ASR** + **ForcedAligner** 中期 SKU | 第三 SKU 质量线；本仓 **0 语段** 根因已定位 | ASR 线 **No-go**；**必须先跑 R3g-B-Align spike** |
| **③** | **说话人分离**（Fun-ASR-Nano diarization · FireRedASR2S） | Descript 类缺口；schema/UI 均未就绪 | **P2 新 Epic**；FunASR `cam++` 路径优先于换引擎 |
| **④** | **ASR Leaderboard** 长音频 + **RTFx** 评测体系 | 补 `fixtures/eval`；别只看短句 WER | **P1 薄 slice**：扩展 manifest + `eval-run` 指标列 |

**paperswithcode.co 说明**：站点已于 2025-07 关停 SOTA 榜单，现跳转 [HF Trending Papers](https://paperswithcode.com/)。ASR 榜单真源改为 [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open-asr-leaderboard)、[ASR Leaderboard 论文](https://arxiv.org/abs/2510.06961)（arXiv:2510.06961）。

---

## ① Fun-ASR 技术报告 · Fun-ASR-Nano · sentence_info 契约

### 1.1 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 中文长课音频（13～21min+）本机转写，需要 **多语段 + 时间轴 + 标点**；部分用户需要 **方言/远场** 更好识别 |
| **本仓现状** | Catalog 仅 **Paraformer-long-vad-punc**（`model_catalog.py`）；分段真源 `segmentation.py` 优先解析 `sentence_info`，其次 `timestamp`，长音频无轴则 **0 段**（禁止 whole-track fallback） |
| **成功标准（spike）** | 源码 venv 下 `FunAudioLLM/Fun-ASR-Nano-2512` 经 **同一** `transcribe_upload` → **≥10 段** + `segmentation_mode=sentence_info`；制控样例 wall ≤ **2× Paraformer** 记 Defer，≤ **1.5×** 记 Go 候选 |

### 1.2 业内路线

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| A | **Fun-ASR-Nano（FunASR AutoModel）** | Fun-ASR-Nano-2512 | LLM-ASR ~800M；`trust_remote_code` + `remote_code=./model.py`；VAD + 可选 ct-punc；**2026/05 起** `spk_model=cam++` 句级 speaker | [Fun-ASR README](https://github.com/FunAudioLLM/Fun-ASR)、[arXiv:2509.12508](https://arxiv.org/abs/2509.12508) |
| B | **Paraformer v2 + VAD + ct-punc（现状）** | `iic/speech_paraformer-large-vad-punc_*` | 非自回归 + 外挂标点；`sentence_timestamp=True` → `sentence_info` | 本仓 R3g-A ✅ |
| C | **Fun-ASR-Nano + vLLM** | `AutoModelVLLM` | 192min 音频 RTFx **393×** vs PyTorch 19.6×；需 CUDA + vLLM≥0.12 | [Fun-ASR vLLM Guide](https://github.com/FunAudioLLM/Fun-ASR/blob/main/docs/vllm_guide.md) |

**Fun-ASR 报告要点（与 Rushi 直接相关）**

- 训练管线含 **VAD → 多 ASR 伪标（Paraformer-V2、Whisper、SenseVoice）→ ITN**，与 Rushi `use_itn` / R3g-C Profile 同族问题。
- **Fun-ASR-nano** 在远场、复杂背景、方言子集上 WER 优于 **Paraformer v2**（报告 Table：远场 5.79% vs 9.55% 等）。
- **SenseVoice** 为 encoder 预训练来源之一；百炼侧 SenseVoice 下线时间线见 backlog §3.3，本仓 catalog 已 **去 SenseVoice 主推 Paraformer**。

### 1.3 FunASR 注册与 Rushi 契约对齐

| 检查项 | 现状 | 说明 |
|--------|------|------|
| `funasr_pipeline.recognizer_needs_punc_pipeline` | `"fun-asr-nano" in mid` → **False** | 与 Qwen 同族：不走 ct-punc 管道 ✅ 已预留 |
| `localAsrModelCatalog.ts` `hubModelNeedsPuncPrepare` | 同上 | TS 与 Python 一致 ✅ |
| **Catalog 条目** | **无** Nano SKU | 符合 R3g-B 门禁 |
| **FunASR 版本** | Spike 环境 **1.3.9** 可跑 Qwen；Nano 需 **`funasr>=1.3.3` + 源码 FunASR**（diarization 文档要求 `pip install git+https://github.com/modelscope/FunASR.git`） | 与 bundled lock **可能分叉** → R3h-ASR-VER |
| **`sentence_info` 字段** | Fun-ASR README：带 VAD 的 `generate()` 应返回 `sentence_info`（含 `start`/`end` ms、`text`；diarization 时含 **`spk`**） | Rushi `segments_from_sentence_info` **不读 `spk`**，可忽略直至 ③ |
| **`trust_remote_code`** | Nano **必须**；侧车 `_get_model` 已 `trust_remote_code=True` | PyInstaller 需验证 `model.py` 打包 |
| **热词** | README 示例 `hotwords=["开放时间"]` | 与 Rushi `POST /v1/transcribe` `hotwords` 字段可对齐 spike |
| **语言参数** | Nano 用 `"中文"` 非 `zh` | 已有 `funasr_language_for_model`（Qwen spike 补 `zh→Chinese`）；Nano 需同样映射 |

**与 Paraformer 的关键差异**

```text
Paraformer:  recognizer + fsmn-vad + ct-punc + sentence_timestamp → sentence_info
Fun-ASR-Nano: 端到端 LLM-ASR + 可选 VAD；punc 可能内置；sentence_info 依赖 FunASR 封装版本
Qwen3-ASR:   无 Aligner → 无 timestamp → Rushi 0 段（见 ②）
```

### 1.4 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | 内存/磁盘 |
|------|--------|----------|------|-----------|
| **A Nano + FunASR** | **高** | `_get_model`、`segmentation.py`、`transcribe_windows`、R3e-C Job、`eval-run` | `remote_code`、lock bump、**~800M–1GB+ 权重** | 与 Paraformer **并存可能超 5GB** → 互斥缓存文案 |
| **B 维持 Paraformer** | **高** | 全链路签收（制控 **197 段 / 155.5s**） | 方言/远场 WER 劣于 Nano 报告值 | 已知 ~1–2GB SKU |
| **C Nano + vLLM** | **低** | — | **第二运行时**；ADR postprocess 已否决 bundled vLLM 用于 LLM | CUDA 专用；与 CPU 侧车矩阵冲突 |

**本仓必须先复用**：`segmentation.py`（禁止 fork 第二套分段内核）、`funasr_engine.py`、`asr_model_profile.py`、`scripts/eval-run.py`。

### 1.5 决策（①）

| 问题 | 结论 |
|------|------|
| **选定方案** | **Defer 产品化**；下一 spike：**Fun-ASR-Nano-2512 + fsmn-vad**（不含 vLLM、不含 diarization），对照制控 + clear 短样本 |
| **不做什么** | 不在本 slice bump `requirements-sidecar-*.lock`；不上 catalog；不替换 Paraformer 默认推荐 |
| **Go 闸门（建议）** | N1：制控 **≥10 段**；N2：`sentence_info` 模式；N3：wall **≤2×** Paraformer；N4：prepare 磁盘 **≤2GB** 增量；N5：bundled PyInstaller **import 不 500**（Phase 3） |
| **与 ADR** | ADR-0003 FunASR-first ✅；Nano 仍在 FunASR 栈内 |
| **排序** | **Qwen3-Align Go/No-go 之后** 再 Nano spike（backlog §7：质量线 Qwen → 速度线 Nano） |

---

## ② Qwen3-ASR + ForcedAligner 中期 SKU

### 2.1 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 希望 **多语/方言** 或 **更强鲁棒性** 的第三本机 SKU，且仍要波形 **多语段** |
| **本仓现状** | [R3g-B spike](./r3g-b-qwen3-asr-spike-results.md) **No-go**（2026-06-03）：Qwen3-0.6B 长音频 **0 段**、wall **1012.9s**（6.5× Paraformer） |
| **根因** | FunASR 日志：`return_time_stamps requires forced_aligner. Skipping timestamps.` → `segmentation.py` 无 `sentence_info`/`timestamp` 可解析 |
| **成功标准** | [R3g-B-Align research](./r3g-b-align-qwen3-forced-aligner-spike-research.md) §4.1 **A1–A9**；**A1**：制控 **≥10 段** 为 Go 必要条件 |

### 2.2 业内路线

| # | 路线 | 代表 | 机制 |
|---|------|------|------|
| A | **FunASR + `forced_aligner`** | Qwen3-ASR-0.6B + Qwen3-ForcedAligner-0.6B | `AutoModel(forced_aligner=...)` + `return_time_stamps` |
| B | **qwen-asr 官方** | `Qwen3ASRModel.transcribe` | 长音频分 chunk → 每 chunk `align()`；**≤5min/次** 对齐上限 |
| C | **Paraformer only** | 本仓默认 | VAD + ct-punc + `sentence_info` — **零增量** |

**Qwen3-ASR 报告要点**（[arXiv:2601.21337](https://arxiv.org/abs/2601.21337)）

- 1.7B：**开源 ASR SOTA 梯队**；0.6B：**精度-体积** 平衡，适合端侧。
- **Qwen3-ForcedAligner-0.6B**：11 语强制对齐；长音频需 **chunk + offset**（与 R3e-B 300s 窗 **可能协同**）。
- 52 语 + 22 中文方言/口音 — 与 Rushi 中文课场景 **高度相关**。
- 官方强调 **VAD** 防低音量幻觉 — 与本仓 `fsmn-vad` 策略一致。

**Open ASR Leaderboard 语境**（2026）：Qwen3-ASR-1.7B、Granite Speech、Cohere Transcribe 居英文榜前列；**中文长口述** 仍以本仓 **制控 fixture + term_hit** 为主真源，不盲信英文 WER。

### 2.3 实测摘要（已签收）

| 指标 | Paraformer | Qwen3-0.6B（无 Aligner） |
|------|------------|--------------------------|
| 制控 ~21min 语段数 | **197** | **0** |
| wall | **155.5s** | **1012.9s** |
| prepare / health | ✅ | ✅ |
| warnings | — | `funasr_long_audio_no_segments` |

Spike 期间合入：`funasr>=1.3.3`、`qwen-asr`、`zh→Chinese` 映射 — **不解决时间轴**。

### 2.4 可复用评估

| 路线 | 复用度 | 落位 | 风险 |
|------|--------|------|------|
| **A FunASR+Aligner** | **高** | `funasr_engine._get_model` 增 `RUSHI_FUNASR_FORCED_ALIGNER`；`model_prepare` 增 Aligner 权重；可能扩 `segmentation.py` | 磁盘 +~0.6B；5min 对齐上限；wall 可能 **≤3×** Paraformer 仅 Defer |
| **B qwen-asr 直连** | 中 | 易成 **第二真源** | spike **不采纳**除非 A 失败 |
| **C 放弃 Qwen** | 高 | 维持单 SKU catalog | 失去多语/营销点 |

### 2.5 决策（②）

| 问题 | 结论 |
|------|------|
| **选定方案** | **不 reopen R3g-B catalog**；**下一动作 = 执行 R3g-B-Align spike**（2–4 人日，见 align research §5） |
| **不做什么** | 不上 1.7B；不接 vLLM；不与 EXP-WORD 同 PR |
| **Align Go 后** | 才允许起草 `r3g-b-qwen3-asr-sku-intent.md`；仍须过 G8 wall、G6 磁盘、PyInstaller |
| **Align No-go** | **归档 Qwen3 SKU 线**；主推 Paraformer → 转向 **① Nano** 或 ③ diarization |

---

## ③ 说话人分离（Fun-ASR-Nano · FireRedASR2S）

### 3.1 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 多人问答课、访谈；转写后需 **说话人 A/B/C** 标签，导出与编辑可区分发言者（Descript / AssemblyAI 标配） |
| **本仓现状** | **无** `speaker` / `speaker_label` 于 `TranscriptionSegment`、SQLite 主段表、Tauri 层；`collaboration-storage-schema.md` 有 `speaker_label` **仅协作草案**；在线 STT 调研已列 AssemblyAI `speaker_labels` |
| **成功标准（产品化，非本 brief）** | 本机转写后语段带 **稳定 speaker id**；波形/列表可编辑；导出格式含说话人列 |

### 3.2 业内路线

| # | 路线 | 代表 | 机制 | 与 Rushi |
|---|------|------|------|----------|
| A | **FunASR diarization** | Fun-ASR-Nano + `spk_model="cam++"` + VAD + punc | `sentence_info[].spk` 句级标签 | **同栈**；依赖 ① Nano 先通 |
| B | **FireRedASR2S 流水线** | FireRedVAD → FireRedLID → FireRedASR2 → FireRedPunc | 模块化；**非 FunASR** | [arXiv:2603.10420](https://arxiv.org/abs/2603.10420)；backlog **ASR-RADAR-FireRed**；ADR-0003 **v1 不做第三引擎** |
| C | **在线 Provider** | AssemblyAI U3 diarization、ElevenLabs Scribe v2 | 云 Job 返回 speaker segments | 已有 adapter 架构；**音频出境** |
| D | **pyannote / 独立 diarization** | pyannote.audio 3.x | 与 ASR **两阶段** | 第二套权重 + 对齐复杂度；**spike 不采纳** |

**Fun-ASR-Nano diarization（2026/05）**

```python
# Fun-ASR README 摘录 — 句级 spk 在 sentence_info
AutoModel(..., vad_model="fsmn-vad", spk_model="cam++", punc_model="ct-punc")
for sent in res[0]["sentence_info"]:
    print(f"Speaker {sent['spk']}: ...")
```

**FireRedASR2S 要点**

- **FireRedVAD**：100+ 语；报告声称优于 FunASR-VAD / Silero。
- **FireRedASR2-AED**：词级时间戳；**LLM 版 8B+** 精度更高。
- **不提供** 与 Rushi 同构的 HTTP 侧车；接入 = 新引擎 Epic，触发 ADR-0003 附录评估。

### 3.3 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 |
|------|--------|----------|------|
| **A FunASR cam++** | **中高** | `segmentation.py` 读 `spk`；扩展 `TranscriptionSegment` + DB 迁移 + UI chip | **schema 全栈**；`cam++` 权重 + 磁盘；与 ① Nano 绑定 |
| **B FireRed** | **低** | VAD/Punc 思路参考 | **非 FunASR**；60s AED 输入上限（backlog）；打包/signing 重做 |
| **C 在线 diarization** | **中** | `stt_native`、capabilities `diarization` | 隐私；与「本机优先」叙事冲突 |

### 3.4 决策（③）

| 问题 | 结论 |
|------|------|
| **选定方案** | **P2 新 Epic「R3g-D diarization」**；技术路径 **A（Fun-ASR-Nano + cam++）** 优先，**在 ① Nano spike Go 之后** 单独立项 |
| **不做什么** | v1 **不做** FireRed 第三引擎；不做 pyannote 两阶段；不做 `auto_punctuate` 之外的 LLM 说话人推断 |
| **前置依赖** | ① Nano 或 Paraformer 稳定 `sentence_info`；schema 设计（`speaker_id: string \| null`）+ 导出 + Close Gate |
| **在线** | ACC-STT 扩展 `capabilities.diarization` 作 **云对照**，不挡本机路径 |
| **估时** | 大（**2–3 周** 纵向薄片）：schema → 侧车 → 导入 → 列表/波形 UI → 导出 |

---

## ④ ASR Leaderboard 方法论 · 长音频 + RTFx 评测体系

### 4.1 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 发版前对比 **Paraformer vs 候选 SKU**；Regression 不只看 AISHELL 短句 |
| **本仓现状** | `fixtures/eval/eval_manifest.v1.json`：5 类占位 + **制控** term_hit；`scripts/eval-run.py` 输出 **CER / term_hit / low_confidence_ratio / wall**；**无 RTFx、无语段数、无 long-form 轨** |
| **成功标准** | 一条命令产出：**WER/CER + term_hit + segment_count + wall_sec + RTFx + segmentation_mode**；manifest 含 **≥1 条 ≥13min** 长音频轨 |

### 4.2 ASR Leaderboard 可借鉴项（arXiv:2510.06961）

| 维度 | Leaderboard 做法 | Rushi 映射 |
|------|------------------|------------|
| **长音频轨** | 独立 long-form English 数据集 | 制控.mp3（~21min）+ R3g 13min fixture（若有） |
| **RTFx** | inverse RTF = 音频时长 / 推理时长 | `RTFx = duration_sec / wall_sec`（侧车 blocking 即可） |
| **WER 归一化** | 统一 text normalization | 可选：ITN 开/关 双列（R3g-C Profile） |
| **架构结论** | Conformer+Transformer WER 优；CTC/TDT RTFx 优 | Inform **R3e 窗宽** tuning，不换引擎 |
| **多 toolkit** | ESPNet / NeMo / SpeechBrain / HF | Rushi **仅 FunASR**；在线 STT 另 manifest 轨 |

**与 Open ASR Leaderboard 差异**：后者偏 **英文 LibriSpeech / Common Voice**；Rushi 主场景 **中文口述 + 术语 + 长轨**，须保留 **term_hit** 与 **segment_count**（语段可用性比 WER 更硬）。

### 4.3 本仓 eval 缺口

| 已有 | 缺失 |
|------|------|
| `cer_chars`、`term_hit_rate` | **segment_count**、**segmentation_mode**（来自 warnings 或侧车 meta） |
| `eval-run` wall 隐含于脚本 | 显式 **`rtfx`**、**`duration_sec`** |
| 制控长样本 | **long_form** category；**reference_transcript** 填齐后可算 CER |
| CSV 输出 | 列：`engine`, `model_id`, `segment_count`, `rtfx`, `wall_sec`, `term_hit_rate`, `cer_chars` |
| checkpoint | `fixtures/eval/checkpoint.example.json` 未接 CI |

### 4.4 可复用评估

| 组件 | 复用度 | 落位 |
|------|--------|------|
| `eval-run.py` | **高** | 增 RTFx/segment 列；解析 `TranscriptionResult` + warnings |
| `eval_metrics.py` | **高** | 增 `rtfx(duration, wall)` |
| `eval_manifest.v1.json` | **高** | 新 category `long_form`；可选 `min_segments` 断言 |
| HF Leaderboard 数据 | **低** | 不导入英文榜；仅方法论 |

### 4.5 决策（④）

| 问题 | 结论 |
|------|------|
| **选定方案** | **P1 薄 slice「ACC-EVAL-2 long-form metrics」**（1–2d）：扩展 manifest schema + `eval-run` 输出，**不改侧车** |
| **不做什么** | 不在 v1 复现 86 系统 × 12 数据集；不接 HF Leaderboard API |
| **验收** | `npm run eval:run` 对制控输出 `segment_count=197`（Paraformer 基线）、`rtfx≈8.0`（1250/155.5）；文档写入 [`fixtures/eval/README.md`](../../../fixtures/eval/README.md) |
| **与发版** | 候选 SKU spike（①②）**必须**附 eval-run JSON 报告进 `docs/execution/spike-output/` |

---

## 5. 横切：建议执行顺序

```text
【已签收】Paraformer + R3e-C + eval term_hit (ACC-EVAL-1)
    ↓
【P1】④ ACC-EVAL-2：eval-run + RTFx + segment_count ✅（2026-06-11）
    ↓
【P1】② R3g-B-Align spike：代码接线 ✅ · 手测待跑（2–4d）
    ├─ Go  → Qwen3 catalog 产品化 intent
    └─ No-go ↓
【P2】① Fun-ASR-Nano spike（2–4d，源码 venv）
    ├─ Go  → Nano catalog 或替换 SenseVoice 生态位
    └─ 并行雷达 FireRed（只文档，不编码）
【P2】③ R3g-D diarization Epic（依赖 ① + schema）
```

| 优先级 | ID | 估时 | 依赖 |
|--------|-----|------|------|
| **P1** | ACC-EVAL-2 | 1–2d | 无 |
| **P1** | R3g-B-Align spike | 2–4d | funasr≥1.3.3 ✅ |
| **P2** | Fun-ASR-Nano spike | 2–4d | Align 结论；R3h-ASR-VER 建议 |
| **P2** | R3g-D diarization | 大 | ① + schema |
| **雷达** | FireRedASR2S | — | ADR-0003；不 v1 编码 |

---

## 6. 落位预告（按子项 Go 后）

| 子项 | Rust | Python ASR | UI | 测试 |
|------|------|------------|-----|------|
| ① Nano | — | `model_catalog.py`, `asr_model_profile.py`, `funasr_engine.py` | `localAsrModelCatalog.ts` | catalog + segmentation 单测 |
| ② Align | — | `funasr_engine.py`, `model_prepare*.py`, `segmentation.py?` | — | forced_aligner fixture |
| ③ Diarization | DB migration | `segmentation.py`, schemas | 语段列表 speaker chip | export + roundtrip |
| ④ Eval | — | `eval_metrics.py` | — | `test_eval_run_csv.py` 增列 |

---

## 7. 签收

- [x] 调研 brief 完成（2026-06-11）
- [x] ④ ACC-EVAL-2 intent — [`acc-eval-2-long-form-metrics-intent.md`](./acc-eval-2-long-form-metrics-intent.md) · 手测 ✅
- [ ] ② R3g-B-Align spike 手测清单 + results
- [ ] 路线图 §4.1.8 链入本文
- [ ] 用户确认 P1 顺序（④ 与 ② 可并行）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-11 | 初版：paperswithcode 迁移说明 + 前四项（Nano / Qwen+Align / diarization / eval） |

# 调研：在线 STT 自动分段 — NLP / 对齐技术栈与业内新方案

> **状态**：规划门禁（2026-06-07）  
> **关联**：[`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md)、[`stt-online-providers.md`](../../architecture/stt-online-providers.md)、[`r3g-b-align-qwen3-forced-aligner-spike-research.md`](./r3g-b-align-qwen3-forced-aligner-spike-research.md)  
> **前置对话**：在线百炼同步仅整轨 1 语段；用户要求「所有在线模型自动分段」且关心 **时间戳能否精确、是否业内可接受**  
> **门禁**：未完成本文 **不得** 定稿「在线统一分段」Plan 与业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 口述史桌面端：在线 STT（OpenAI / AssemblyAI / Deepgram / 百炼 / 自定义代理）拉取后需 **多条语段 + 可波形对齐的时间轴**；不能长期停在整轨单段。 |
| **本仓现状** | 本机 Paraformer：`segmentation.py` + VAD/`sentence_info`（Tier A 声学真源）。在线：各 adapter 分散——AssemblyAI/Deepgram 有词级 gap 切句；OpenAI `verbose_json.segments`；百炼同步非 SSE 仅 1 `sentence`；`rushi_value` 整轨兜底。无统一 `TimedWord → segments` 管道；**无** 在线 forced alignment 二 pass。 |
| **成功标准** | ① 能力矩阵诚实区分 **分段** vs **时间戳精度**；② 选定方案在 2～3 个厂商 + 百炼上可手测（波形抽样误差 &lt;500ms 句首为「可用」，&gt;1s 系统偏差须 warning）；③ 不违背 architecture「声学分段真源、禁止整轨纯文本贴时间作主路径」。 |

---

## 2. 业内成熟路线（≥5）

### 路线 A — 云 STT API **原生** 词/句时间戳（生产主流）

| 代表 | 机制 | 分段 | 时间戳可信度 | 链接 |
|------|------|------|--------------|------|
| **AssemblyAI** Universal-3 Pro / U2 | 异步 Job → `words[]` + `utterances[]`（turn 级）；可选 `speaker_labels` | utterances 或 words+gap | **高**（ms 级，caption 文档定位） | [Speech recognition](https://www.assemblyai.com/docs/pre-recorded-audio/speech-recognition)、[Get sentences](https://www.assemblyai.com/docs/api-reference/transcripts/get-sentences) |
| **Deepgram** Nova-2/3 `listen` | `alternatives[0].words` start/end（秒） | 客户端按静音/标点切句 | **高** | [Deepgram docs](https://developers.deepgram.com/docs) |
| **Rev.ai** | 默认 JSON 每词 `ts`/`end_ts`；`forced_alignment=true` 提升词级精度 | monologues + elements | **高**（forced alignment 限 en/fr/de/es/it） | [Features](https://docs.rev.ai/api/features)、[Submit job](https://docs.rev.ai/api/asynchronous/reference/jobs/submittranscriptionjob.md) |
| **Speechmatics** | Batch JSON `results[]` 含 word `start_time`/`end_time` | 内置句/段结构 | **高** | [Output](https://docs.speechmatics.com/speech-to-text/batch/output) |
| **ElevenLabs Scribe v2**（2025 发布） | `timestamps_granularity=word`；可选 diarization | words → 客户端切句 | **高** | [Scribe v2 blog](https://elevenlabs.io/blog/introducing-scribe-v2)、[API](https://elevenlabs.io/docs/api-reference/speech-to-text/convert) |
| **OpenAI** | **`whisper-1` + `verbose_json` + `timestamp_granularities[]=word|segment`** | segments 或 words | **段级可靠；词级有额外延迟** | [Speech to text](https://platform.openai.com/docs/guides/speech-to-text) |
| **OpenAI gpt-4o-transcribe / mini** | 更高 WER；**仅 json/text**；**无** word timestamps | 无原生分句时间轴 | **N/A（转写文本优，非剪辑轴）** | 同上 |
| **OpenAI gpt-4o-transcribe-diarize** | `diarized_json` 说话人段 | speaker segments | **段级+说话人，非词级** | 同上 |
| **阿里云百炼 Fun-ASR** | **SSE/WebSocket**：`sentence_end=true` 多句 + `words[]` ms；同步非 SSE 常单句 | VAD/`max_sentence_silence` 句界 | **高（需 SSE/流式或异步 file_urls）** | [Fun-ASR REST](https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-restful-api)、[实时 ASR 时间戳](https://help.aliyun.com/zh/model-studio/real-time-speech-recognition) |

**产品层**：Descript / Otter / Sonix 等剪辑向产品依赖 **词级或句级 API 时间戳 + 编辑器对齐**，而非「纯文本比例切分」；Descript 播放高亮当前词（[Playback and navigation](https://help.descript.com/hc/en-us/articles/10164534109837-Playback-and-navigation)）。

---

### 路线 B — **Forced alignment**（已知文本 ↔ 音频，二 pass）

适用：**已有转写文本**（在线 STT 全文已得），需补/ refine 时间轴。

| 工具 / 模型 | Repo / 文献 | 机制 | 语言 | 备注 |
|-------------|-------------|------|------|------|
| **WhisperX** | [m-bain/whisperX](https://github.com/m-bain/whisperX) | VAD 切窗 → Whisper 转写 → **wav2vec2 phoneme alignment** | 多语 | 论文：[WhisperX arXiv:2303.00747](https://arxiv.org/html/2303.00747v2) — **Whisper 自带 timestamp 不可靠** |
| **stable-ts** | [jianfch/stable-ts](https://github.com/jianfch/stable-ts)（~2k stars，2025 仍活跃） | Whisper + **DTW** 稳定 timestamp；`align()` / `align_words()` 对**已有文本**对齐 | 99 语 | 2.x 起 DTW；社区对比 WhisperX 优劣不一（[Discussion #376](https://github.com/jianfch/stable-ts/discussions/376)） |
| **whisper-timestamped** | [linto-ai/whisper-timestamped](https://github.com/linto-ai/whisper-timestamped) | 早期 cross-attention 抽 timestamp（1.x）；现多被 stable-ts/WhisperX 取代 | 多语 | VAD 可选；Silero 误检讨论多 |
| **Montreal Forced Aligner 3.x** | [MFA 3.3 docs](https://montreal-forced-aligner.readthedocs.io/en/v3.3.5/user_guide/index.html) | **Kaldi** 音素级对齐；`mfa align` / `align_one` | 需词典+声学模型 | **准但慢、运维重**；中文需 `mandarin_mfa` 等模型 |
| **Meta Seamless UnitY2 aligner** | [seamless_communication](https://github.com/facebookresearch/seamless_communication) `nar_t2u_aligner` | 多语（38 语）token–unit 对齐 | 38 | [Nature SeamlessM4T](https://www.nature.com/articles/s41586-024-08359-z) |
| **Qwen3-ForcedAligner-0.6B** | [QwenLM/Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR)、[HF](https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B)、[arXiv:2601.21337](https://arxiv.org/html/2601.21337v1) | **NAR slot-filling** 词/字级 timestamp；可 standalone `align(text, audio)` | **11 语含中文** | 本仓 R3g-B-Align spike 已调研；FunASR 路径需 `forced_aligner` env |
| **Speechmatics Alignment API** | [Alignment docs](https://docs.speechmatics.com/speech-to-text/batch/alignment) | 提交 **audio + text** → 仅返回对齐时间 | 多语 | 与 STT 解耦的 **官方 forced alignment** |
| **Rev.ai `forced_alignment`** | 见路线 A | 异步 Job 参数 | en/fr/de/es/it | 提升已有 transcript 词级 timestamp |

**文献共识**：WhisperX 明确写「remove reliance on Whisper timestamps — too unreliable」；forced alignment 是 **字幕/剪辑级词轴** 的常见补全手段，而非替代 ASR 转写。

---

### 路线 C — **VAD + 分窗 ASR + 时间偏移合并**（长音频本机范式）

| 代表 | 机制 | 本仓 |
|------|------|------|
| WhisperX 长音频 | Silero VAD → ~30s chunk → 并行 Whisper → offset merge | 思想同 R3e-B `transcribe_windows.py` |
| FunASR Paraformer | VAD + `sentence_info` / 窗级 | **R3t-A 真源** [`segmentation.py`](../../../services/asr/rushi_asr/segmentation.py) |
| 百炼 Fun-ASR | `max_sentence_silence` VAD 断句（实时/SSE） | Rushi 当前 **未接** SSE，故丢失多句 |

---

### 路线 D — **文本启发式分段**（标点 / 字数比例 / LLM 切段）

| 代表 | 精度 | 业内地位 |
|------|------|----------|
| 标点切句 + 时长按字数比例分配 | **低**（无声学） | 草稿/占位；**非** Descript/AssemblyAI 主路径 |
| LLM 重新分段 + 再贴时间 | **低且易漂移** | 本仓 architecture **禁止作主路径**（[`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md) §1） |

---

### 路线 E — **混合：在线 STT 文本 + 本地/云端 Align**（2025+ 可见产品化）

| 模式 | 示例 | 适用 Rushi |
|------|------|------------|
| STT Job → Alignment Job | Speechmatics：先 transcribe 再 `/alignment` | 需新 provider 或网关 |
| STT → `stable-ts align(text)` | 本地 Python 侧车二 pass | 音频已在本地；**不上传**则可用 sidecar；与「在线密钥不出机」可并存 |
| STT → Qwen3-ForcedAligner | 中文口述史 | 与本机 FunASR 栈重叠；**另模型 ~0.6B**；spike 未 Go |
| Rev `forced_alignment=true` | 仅改善已有 Rev transcript 词轴 | 非 Rushi 当前 provider |

---

## 3. 2025–2026 **新发布 / 新动向**（相对本仓上次 STT 调研）

| 时间 | 动向 | 对分段/时间轴的意义 |
|------|------|---------------------|
| 2025 | **AssemblyAI Universal-3 Pro** + 流式 diarization 升级 | 词级 `speaker`、更少 phantom speaker；utterances 仍为分段首选 |
| 2025-12～2026 | **OpenAI gpt-4o-transcribe-diarize** | 说话人段；**不替代** whisper-1 word timestamps |
| 2025 | **ElevenLabs Scribe v2** | 90+ 语、word timestamps、diarization；新竞品 API 档 |
| 2026-01 | **Qwen3-ASR + ForcedAligner** 技术报告 | 中文 forced align **新 SOTA 宣称**；11 语 align；本仓 spike 仍 No-go（未挂 aligner） |
| 持续 | **stable-ts 2.x** DTW + `align_words` | 已知文本快速对齐；subtitle 社区常用 |
| 持续 | **MFA 3.3.x** | 研究/语料库标准工具；桌面产品直连少 |
| 百炼 | Fun-ASR **SSE `sentence_end`**、异步 `sentences[]` | Rushi **同步 Base64 路径未用** → 整轨根因之一 |
| 百炼 | 文档明确：Qwen3-ASR Realtime **无** timestamp；Fun-ASR/Paraformer **有** | 与 ACC-STT-ALI 选型一致 |

**未见**单一「2026 魔法 bullet」取代上述分层；趋势是 **更强 cloud word timestamps** + **专用 ForcedAligner 小模型**（Qwen3-FA、Scribe v2）并存。

---

## 4. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 冲突 | 进度/内存/运维 |
|------|--------|----------|---------------|----------------|
| **A 云原生 words/utterances** | **高** | 已有 AssemblyAI/Deepgram 部分逻辑；补 OpenAI word 粒度、百炼 SSE | 百炼需改 HTTP（SSE 或 async URL） | 无额外模型；依赖网络 |
| **B stable-ts / WhisperX align** | **中** | 侧车 Python 二 pass：`audio + full_text → words → segments` | 中文 Whisper 弱于 Paraformer；**不上传 Key** 可本地跑 | +GPU/CPU；Whisper 模型体积 |
| **B Qwen3-ForcedAligner** | **中（中文）** | 与 R3g-B spike 同；可 **仅 align** 不替换 Paraformer ASR | 第二模型缓存；FunASR 接线未完成 | +~0.6B 权重 |
| **B MFA / Seamless** | **低** | 离线研究、评测 |  conda/Kaldi 重；桌面分发难 | 慢、批处理向 |
| **C 百炼 SSE 多句** | **高** | 改 `dashscope_asr.rs` 解析 SSE | 长连接/超时；仍受 20MiB data-uri 限 | 同在线 STT |
| **D 比例切分** | **高（代码）** | 统一 fallback | **不可声称精确**；仅 Tier C | 零成本 |
| **E Speechmatics/Rev align API** | **低** | 新 vendor | 密钥、合规、第二套计费 | 异步 Job |

**本仓必须先复用（禁止 fork 第二套分段真源）**

- 在线：**升格** `assemblyai_words_to_segments` → 共享 `online_timed_words.rs`（或 `transcribe_segmentation.rs`）
- 在线统一 choke point：`run_transcribe_cmd` `transcribe_stage=parse` 后 `normalize_online_segments`
- 本机：仍只认 `segmentation.py`；在线 align **不得** 写成本机 Paraformer 替代
- 已有 warning/hints 模式：`funasr_whole_track_fallback` → 类比 `online_segmentation_*`

---

## 5. 「时间戳精确」如何验证（业内可接受标准）

| Tier | 来源 | 产品承诺 | 验证方法 |
|------|------|----------|----------|
| **A** | API words / utterances / SSE `sentence_end` | Caption、剪辑、Descript 类 | 抽样 10 句，波形量句首误差；**&lt;300ms 中位数** 为「语段级可用」 |
| **B** | Forced alignment | 字幕精修、已知稿对齐 | 同上；MFA/align 在评测集上 WER 无关、**边界 IoU** 或人工 |
| **C** | 标点+比例 | **仅草稿** | **不得**标 `segmentTimestamps: true`；UI 明示估算 |

**业内可接受性**：

- **是**：Tier A/B 为 STT/SaaS **普遍方案**（Modulate 2026 API 对比表默认 word/segment timestamps；AssemblyAI/Deepgram 文档以 caption 为卖点）。
- **否**：Tier C 作为 **唯一** 方案且 silent 冒充精确 — 不符合剪辑类产品惯例。
- **折中**：Tier C 作 **最后 fallback** + `online_segmentation_proportional` warning — 可接受，类似本机 `funasr_whole_track_fallback` 诚实降级。

**OpenAI 特例**：生产若用 `gpt-4o-transcribe` 求准确率，须 **另开 whisper-1 word 轴** 或 **stable-ts align**，不能假设 gpt-4o 输出可剪辑。

---

## 6. 决策摘要（调研结论，非编码承诺）

| 问题 | 结论 |
|------|------|
| **有无新解决方案？** | 有 incremental 更新（U3 Pro、Scribe v2、Qwen3-FA、百炼 SSE 文档化），**无**统一替代「词级 API + 可选 align」的新范式。 |
| **统一办法** | **Adapter 抽 TimedWord → 共享切句 → 厂商原生优先 → 可选本地 align 二 pass → Tier C 比例兜底+warning**；**不是**单一 NLP 包解决所有厂商。 |
| **百炼** | 优先 **SSE 收 `sentence_end`** 或 **words gap 切句**；异步 `file_urls` 为长音频薄片；同步单句是 API 形态问题非模型不能分句。 |
| **精确时间戳** | **仅 Tier A/B 可验收**；比例切分只保证「多段可编辑」。 |
| **不做什么** | ① LLM 切段贴时间作主路径；② MFA/Seamless 进桌面默认栈；③ 无 warning 的比例切分；④ 宣称 gpt-4o-transcribe 有词级轴。 |
| **与 ADR/architecture** | 对齐 [`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md) L2 声学真源；在线为 **并行薄层**，本机 Paraformer 仍为口述史 **精度基准**。 |
| **Spike 项** | ① 百炼 SSE 原型；② OpenAI `timestamp_granularities=word`；③ 可选 `stable-ts align_words` 对在线全文（中文效果需样本）；④ Qwen3-FA 仅当 R3g-B-Align Go |

---

## 7. 落位预告（若进入 Plan）

| 层 | 模块 | 变更类型 |
|----|------|----------|
| Rust | `project/online_segment_normalize.rs`（新） | TimedWord、gap/punctuation 切句、Tier C fallback |
| Rust | `stt_native/dashscope_asr.rs` | SSE 或多句解析 |
| Rust | `project/transcribe.rs` | OpenAI word 粒度；Deepgram 调共享切句 |
| Rust | `run_transcribe_cmd.rs` | 在线统一 normalize 入口 |
| TS | `definitions.ts` capabilities | 拆分 `wordTimestamps` / `segmentTimestamps` |
| TS | `asrTranscribeHints.ts` | `online_segmentation_proportional` 等 |
| Python（可选） | `services/asr/` align 子命令 | stable-ts 或 Qwen3-FA spike |
| 文档 | `stt-online-providers.md` | 精度 Tier 说明 |
| 测试 | Rust unit + 手测 checklist | 波形抽样 |

---

## 8. 参考索引（可验证）

| 类别 | 链接 |
|------|------|
| WhisperX 论文 | https://arxiv.org/html/2303.00747v2 |
| stable-ts | https://github.com/jianfch/stable-ts |
| Qwen3-ASR 报告 | https://arxiv.org/html/2601.21337v1 |
| AssemblyAI U3 / diarization | https://www.assemblyai.com/blog/streaming-diarization-major-upgrade |
| OpenAI STT timestamps | https://platform.openai.com/docs/guides/speech-to-text |
| ElevenLabs Scribe v2 | https://elevenlabs.io/blog/introducing-scribe-v2 |
| 百炼 Fun-ASR REST/SSE | https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-restful-api |
| Speechmatics alignment | https://docs.speechmatics.com/speech-to-text/batch/alignment |
| Rev forced_alignment | https://docs.rev.ai/api/asynchronous/reference/jobs/submittranscriptionjob.md |
| MFA 3.x | https://montreal-forced-aligner.readthedocs.io/en/v3.3.5/user_guide/index.html |
| Seamless aligner | https://github.com/facebookresearch/seamless_communication/blob/main/docs/m4t/unity2_aligner_README.md |
| 本仓 R3g-B align spike | [`r3g-b-align-qwen3-forced-aligner-spike-research.md`](./r3g-b-align-qwen3-forced-aligner-spike-research.md) |

---

## 9. 签收

- [x] 调研 brief 完成（2026-06-07）
- [x] intent / plan / acceptance 已链接本文
  - Intent：[`online-stt-segment-unify-intent.md`](./online-stt-segment-unify-intent.md)
  - Plan：[`online-stt-segment-unify-plan.md`](./online-stt-segment-unify-plan.md)
  - Acceptance：[`online-stt-segment-unify-acceptance.md`](./online-stt-segment-unify-acceptance.md)
  - Hand-test：[`online-stt-segment-unify-hand-test-checklist.md`](./online-stt-segment-unify-hand-test-checklist.md)
- [ ] 用户确认可进入 Implement（编码）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-07 | 初版：云 API / forced alignment / VAD / 启发式 / 混合五类；2025–2026 产品发布；精度 Tier 与 Rushi 落位预告 |
| 2026-06-07 | 链接 intent / plan / acceptance / hand-test 三件套+手测 |

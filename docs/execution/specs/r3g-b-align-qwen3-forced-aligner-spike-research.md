# 调研：R3g-B-Align — Qwen3-ForcedAligner 时间轴 Spike

> **状态**：📋 规划门禁（2026-06-03）· **实测待跑**  
> **前置**：[R3g-B Qwen3-ASR spike](./r3g-b-qwen3-asr-sku-spike-research.md) ❌ **No-go**（[results](./r3g-b-qwen3-asr-spike-results.md)）· **R3g-A / R3e-B/C / R3g-C ✅**  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 **R3g-B-Align**（**P2**，**不挡** ⑤‴ EXP-WORD）  
> **关联 spec（仅 Align Go 后）**：`r3g-b-qwen3-asr-sku-intent.md` / `…-plan.md` / `…-acceptance.md`（重开 R3g-B 产品化）  
> **门禁**：未完成本文 §6 签收 **不得** 改 `funasr_engine` 默认加载 ForcedAligner、**不得** 改 catalog

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 桌面端本机转写后，波形上需要 **多条带 `start_sec` / `end_sec` 的语段** 供编辑、导出（EXP-WORD）、长音频窗式预览（R3e-C）。用户若选用 **Qwen3-ASR** 作为第三 SKU，期望中文长音频（13～20min+）与 Paraformer 一样「能转、能切、能改」。 |
| **本仓现状（2026-06-03）** | **⑤″f-E** 已证明：仅 `RUSHI_FUNASR_MODEL=Qwen/Qwen3-ASR-0.6B` + VAD + `funasr>=1.3.3` + `qwen-asr` 时，推理可跑、`prepare` 可绿，但 **`segments[]` 恒为空**。日志：`return_time_stamps requires forced_aligner. Skipping timestamps.` → R3t-A [`segmentation.py`](../../../services/asr/rushi_asr/segmentation.py) 无 `sentence_info` / `timestamp` 可解析 → `funasr_long_audio_no_segments`。对照：**Paraformer** 同机 `fixtures/eval/samples/制控.mp3` → **197 段 / 155.5s wall**（见 `docs/execution/spike-output/qwen3-2026-06-03/`）。已合入 **`zh`→`Chinese`** 映射（`asr_model_profile.funasr_language_for_model`），**不解决**时间轴。 |
| **Spike 成功标准** | 在 **不改 catalog / 不改 UI 下拉** 前提下，env 侧车挂载 **`forced_aligner=Qwen/Qwen3-ForcedAligner-0.6B`**（及 FunASR 文档要求的 `return_time_stamps` 或等价参数），使 **制控或 13min 样本** 经 **同一** `transcribe_upload` → `segment_funasr_generate_result` 产出 **≥10 非空语段**；并完成 §4.1 硬闸门表。产出 **Go / Defer / No-go**，决定是否重开 **R3g-B catalog 产品化**。 |

**关键路径（spike 期间）**

```text
# 仍不修改 LOCAL_ASR_MODEL_CATALOG
export RUSHI_FUNASR_MODEL=Qwen/Qwen3-ASR-0.6B
export RUSHI_FUNASR_FORCED_ALIGNER=Qwen/Qwen3-ForcedAligner-0.6B   # spike 提议 env，合入前以实现为准

prepare（ASR + Aligner 权重）→ transcribe_upload / POST /v1/transcribe
  → FunASR generate（return_time_stamps 或 FunASR 封装等价项）
  → 解析：sentence_info | timestamp | 必要时新增 qwen_align 分支
  → segments[] 与 Paraformer 同样本 diff
```

**与 ⑤″f-E 的边界**

| ⑤″f-E（已签收） | 本 spike（R3g-B-Align） |
|----------------|-------------------------|
| Qwen3-ASR **能否加载、能否出字** | Qwen3 + Aligner **能否出 Rushi 可吃的轴** |
| 无 `forced_aligner` | **必须** 验证 `forced_aligner` + 分段契约 |
| No-go → 不进 catalog | Align **Go** 才是重开 catalog 的 **必要条件**（非充分：仍要过 G8 等） |

**非目标（本 spike 明确不做）**

- 不上环境页第三 SKU、不改 `localAsrModelCatalog.ts`  
- 不引入 **独立** `Qwen3ASRModel` / vLLM 第二套 HTTP 服务（见路线 B）  
- 不做 Qwen3-1.7B、不做 ForcedAligner **单独** 对外 SKU（仅作为 Qwen ASR 从属权重）  
- 不改 SQLite / L2–L3；不做 STREAM/Realtime  
- **不** 与 EXP-WORD、REV-LOC 编码同一 PR  

---

## 2. 业内成熟路线（≥3）

### A. FunASR `AutoModel` + `forced_aligner`（首选 spike 路径）

| 项 | 内容 |
|----|------|
| **代表** | [FunASR v1.3.3+](https://github.com/modelscope/FunASR/releases/tag/v1.3.3)、[Qwen3-ASR README](https://github.com/QwenLM/Qwen3-ASR)、Rushi 实测日志 |
| **机制** | 加载 ASR 时传入 `forced_aligner="Qwen/Qwen3-ForcedAligner-0.6B"`；`generate()` / 封装层开启时间戳（日志称 `return_time_stamps`）。与现有 [`funasr_engine._get_model`](../../../services/asr/rushi_asr/funasr_engine.py) 单例路径一致。 |
| **与 Rushi** | **ADR-0003 FunASR-first**；复用 `prepare`、`transcribe_windows`、R3e-C Job；仅扩展 `_get_model` + 可选 `segmentation` 解析 |

### B. Qwen 官方 `qwen-asr` 栈（`Qwen3ASRModel.transcribe`）

| 项 | 内容 |
|----|------|
| **代表** | [QwenLM/Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR) `Qwen3ASRModel.from_pretrained(..., forced_aligner=..., return_time_stamps=True)` |
| **机制** | 长音频在官方实现中 **分 chunk** 再 ASR + 按 chunk 调 `forced_aligner.align()`；与 FunASR 封装是否等价 **待 spike 验证** |
| **与 Rushi** | 已依赖 `qwen-asr` 包（⑤″f-E）；**本 spike 不采纳为默认路径**，除非 A 无法产出 `generate()` 可解析字段且 B 能在 ≤2d 内证明可映射进 `TranscriptionSegment` |

### C. 维持 Paraformer 双 SKU（不接 Qwen）

| 项 | 内容 |
|----|------|
| **代表** | 本仓 R3g-A 已签收路径 |
| **机制** | VAD + ct-punc + `sentence_timestamp` → `sentence_info` |
| **与 Rushi** | **零增量**；⑤″f-E 已 No-go 时的 **默认产品策略** |

### D. 第三方强制对齐（WhisperX / stable-ts / MFA）

| 项 | 内容 |
|----|------|
| **代表** | WhisperX、Montreal Forced Aligner |
| **与 Rushi** | 第二套引擎或外部二进制；**spike 不采纳**（违背 FunASR SKU 栈、打包体积） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 |
|------|--------|----------|-------------------|
| **A FunASR+Aligner** | **高** | `_get_model`、`prepare`、`segmentation.py`、`asr_model_profile`（qwen family）、`model_prepare_cache`（safetensors） | Aligner **+~0.6B 权重**；**5min/段** 对齐上限（见 §4.3）；长音频 wall 可能 **>> Paraformer** |
| **B qwen-asr 直连** | **中** | 同 venv 的 `qwen-asr`；语言名 `Chinese` 已验证 | 与 FunASR `generate()` **输出形状可能不一致**；需适配层，易成第二真源 |
| **C Paraformer only** | **高** | 全链路已签收 | 无 Qwen 多语/基准营销点 |
| **D 第三方对齐** | **低** | — | ADR-0003、PyInstaller、单分段内核 |

**本仓必须先复用（禁止 fork 第二套分段内核）**

| 模块 | 路径 | Align spike 用法 |
|------|------|------------------|
| 分段真源 | `segmentation.py` → `segment_funasr_generate_result` | 验证 FunASR 返回是否已有 `sentence_info`/`timestamp`；否则 **最小扩展** 解析分支（须单测） |
| 引擎 | `funasr_engine.py` | `_get_model` 增加 `forced_aligner`；`generate_kwargs` 增加 `return_time_stamps`（若 FunASR 支持） |
| Profile | `asr_model_profile.py` | `sku_family=qwen`；语言映射已存在 |
| Prepare | `model_prepare.py` / `model_prepare_cache.py` | Aligner 权重缓存规则（可能 `config.json` + `*.safetensors`） |
| 长音频 | `transcribe_windows.py` | 窗边界 + Aligner 5min 上限是否冲突（§4.3） |
| ⑤″f-E 基线 | [spike-results](./r3g-b-qwen3-asr-spike-results.md)、`spike-output/qwen3-2026-06-03/` | Paraformer **197/155.5s**；Qwen 无 Aligner **0/1012.9s** |

---

## 4. 决策摘要（spike 前假设）

| 问题 | 结论 |
|------|------|
| **Spike 路径** | **A**：FunASR `AutoModel(forced_aligner=...)` + 现有 `transcribe_upload` |
| **Hub id** | `Qwen/Qwen3-ForcedAligner-0.6B`（与 ASR 0.6B 配对；1.7B ASR **不在**本 spike） |
| **依赖** | `funasr>=1.3.3`、`qwen-asr`（与 ⑤″f-E 一致）；`R3h-ASR-VER` lock 可与此 spike 同轮 |
| **不做什么** | catalog UI、vLLM、独立 Aligner SKU、WhisperX、改 R3t-A 窗长阈值 |
| **与 ADR** | 不修改 **FunASR-first**；Align 是 **R3g-B 重开** 的前置，不是新引擎 |
| **与 ⑤″f-E** | ASR No-go **不推翻**；本 spike 只回答「接上 Aligner 能否救活语段」 |

### 4.1 Go / No-go 阈值（硬闸门）

**全部满足** 才 **Go → 允许起草 R3g-B 产品化 intent**；任一项关键失败 → **No-go**（维持双 SKU）或 **Defer**（仅 G6/G7/G8 类工程项失败）。

| # | 指标 | Paraformer 基准（制控 ~21min） | Qwen3+Aligner 要求 |
|---|------|-------------------------------|-------------------|
| **A1** | 长音频语段数 | **197** | **≥10**，且无 `funasr_whole_track_fallback` |
| **A2** | 相对 baseline | **197** | **≥ max(15, 90%×197)** ≈ **177**（或书面降级：若仅 **≥50 段** 且编辑可用，记 **Defer** 并写清原因） |
| **A3** | 短音频（≤3min） | clear.wav 等 | **≥1** 段 **或** 明确记录「仅长音频 SKU」并 Defer 短样本 |
| **A4** | 分段模式 | `sentence_info` 为主 | `segmentation_mode` ∈ `{sentence_info, vad_timestamp}`；**禁止** 仅 `funasr_long_audio_no_segments` |
| **A5** | 热词样例 | `term_hit_rate` **0.0**（制控） | **≥ baseline**（0.0 即不劣化） |
| **A6** | 磁盘增量 | — | Aligner + 准备依赖 **≤2.5GB**；与现有 models **并存 ≤5GB** 或接受「互斥缓存」文案 |
| **A7** | prepare / health | ready | `required_models_cached` 含 ASR+Aligner；`/health` `ready_for_transcribe` |
| **A8** | wall clock（同机） | **155.5s** | **≤2.0×** Paraformer（**310s**）为 Go；**≤3.0×** 仅记 **Defer**（质量 Go、性能后续 R3g-B2） |
| **A9** | 5min 对齐上限 | VAD 切窗 | **20min 全路径无崩溃**；窗内对齐失败率 **<5%**（warnings 可接受但须可复现记录） |

**Defer**：A1–A5 通过但 A6/A8/A9 失败 → 文档化 blocker，**不进 catalog**。  
**No-go**：A1 或 A4 失败（仍 0 段或仍无轴）→ **永久关闭 Qwen3 SKU 线** 直至 FunASR/Qwen 上游变更。

### 4.2 风险：ForcedAligner 5 分钟上限

[Qwen3-ASR README](https://github.com/QwenLM/Qwen3-ASR) 写明 **ForcedAligner-0.6B** 对 **≤5min** 语音做任意单位对齐；长音频依赖 **chunk + offset**（官方 `qwen_asr` 对长音频分块后再 `align`）。

| 风险 | Spike 必验 |
|------|------------|
| FunASR 整轨一次对齐超 5min | 观察 VAD 窗（现网 `max_single_segment_time` 默认 30s）是否使每窗 **<5min** |
| 窗边界时间轴拼接 | 相邻窗 `start_sec` 单调、无大面积重叠/空洞（抽样 10 段） |
| 仅词级时间戳 | `segmentation.py` 是否需 **聚合为句级** `TranscriptionSegment` |

### 4.3 与 R3g-B 产品化的关系

```text
⑤″f-E (ASR only)     ──No-go──► 停止 catalog
R3g-B-Align (本 spike) ──Go──►   允许 R3g-B intent/plan（catalog + prepare UI + lock）
                      ──No-go──► 维持 Paraformer + SenseVoice；Qwen 线归档
```

---

## 5. Spike 执行计划（2～4 人日）

> 手测清单与 results 表：**Align Go 后** 可复制 ⑤″f-E 模板，文件名建议：  
> `r3g-b-align-forced-aligner-spike-hand-test-checklist.md`、`r3g-b-align-forced-aligner-spike-results.md`  
> 输出目录：`docs/execution/spike-output/qwen3-align-YYYY-MM-DD/`

### Phase 0 — 环境（0.5d）

```bash
cd services/asr && .venv/bin/pip install -U "funasr>=1.3.3" "qwen-asr>=0.0.2"

export RUSHI_FUNASR_MODEL=Qwen/Qwen3-ASR-0.6B
export RUSHI_FUNASR_FORCED_ALIGNER=Qwen/Qwen3-ForcedAligner-0.6B   # 待 funasr_engine 接线；spike 可先改分支/_get_model

# prepare 两套权重后：
# GET /health → ready_for_transcribe, funasr_model_id
```

- [ ] 记录 funasr / torch / qwen-asr 版本  
- [ ] `recognizer_cache_spec` / Aligner 目录完整性（仿 [`test_model_prepare_cache.py`](../../../services/asr/tests/test_model_prepare_cache.py)）

### Phase 1 — 裸 `transcribe_upload`（1d）

| 样本 | 用途 |
|------|------|
| **S1** | `fixtures/eval/samples/制控.mp3`（~21min，代替 13min） |
| **S2** | R3g ⑤c 13min（若仓库有） |
| **S3** | `clear.wav` 短样本 |
| **对照** | 同机 Paraformer 跑 S1（已有 197/155.5s 可引用） |

记录：语段数、首末时间、warnings、`segmentation_mode`、wall、峰值 RSS。

### Phase 2 — Rushi HTTP + 长窗（1d）

- [ ] `POST /v1/transcribe` blocking（env 侧车）  
- [ ] 可选：`transcribe/async` 同样本（**A10**：首窗后 ≤60s 见 ≥1 段 — 仅 Align Go 后）  
- [ ] 打印 FunASR `generate()` **首条 keys**（脱敏）存档，供 `segmentation` 是否需新分支

### Phase 3 — 打包探测（0.5d，可 Defer）

- [ ] `requirements-sidecar-*.lock` 含 Aligner 依赖体积  
- [ ] `npm run asr:build-sidecar-unix` → bundled `/health` import 不 500

### Phase 4 — 结论（0.5d）

填写 §4.1 表 + §6 签收；更新路线图 **R3g-B-Align** 行。

---

## 6. 落位预告（仅 Align **Go** 后）

| 层 | 文件 | 变更类型 |
|----|------|----------|
| Python | `funasr_engine.py` | `_get_model`: `forced_aligner` from env；`generate` kwargs: `return_time_stamps` |
| Python | `asr_model_profile.py` | qwen profile：对齐相关 kwargs（经 spike 实测锁定） |
| Python | `model_prepare.py` / `model_prepare_cache.py` | Aligner 权重 required + cache spec |
| Python | `segmentation.py` | 仅当 FunASR 返回格式 ≠ `sentence_info`/`timestamp` 时 **最小** 新分支 |
| Python | `defaults.py` / `model_catalog.py` | **产品化阶段**；Align spike **不改 catalog** |
| TS | `localAsrModelCatalog.ts` | **R3g-B 产品化**，非 Align spike |
| 锁文件 | `requirements-sidecar-*.lock` | funasr + qwen-asr + Aligner 体积 |
| 测试 | `test_funasr_engine.py`、`test_model_prepare_cache.py`、segmentation 单测 | forced_aligner mock / 样本 JSON fixture |
| 文档 | `r3g-b-qwen3-asr-sku-spike-research.md` §4.2 | 链到本文结论 |

---

## 7. 签收

- [x] 调研 brief 完成（2026-06-03）
- [ ] `r3g-b-align-forced-aligner-spike-hand-test-checklist.md`（spike 开跑前）
- [ ] `r3g-b-align-forced-aligner-spike-results.md`（实测后）
- [ ] 路线图 §4.1.8 **R3g-B-Align** 状态更新为 🔬/✅/❌
- [ ] 用户或路线图确认可进入 **Align spike 编码/手测**（仍 **不** 进 catalog）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-03 | 初版：承接 ⑤″f-E No-go；定义 A1–A9 闸门与 5min 对齐风险 |

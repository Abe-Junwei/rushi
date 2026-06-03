# 调研：R3g-B — Qwen3-ASR SKU Spike

> **状态**：❌ **No-go**（2026-06-03）· 实测见 [results](./r3g-b-qwen3-asr-spike-results.md) · 输出 `docs/execution/spike-output/qwen3-2026-06-03/`  
> **手测**：[r3g-b-qwen3-asr-spike-hand-test-checklist.md](./r3g-b-qwen3-asr-spike-hand-test-checklist.md) · [results 表](./r3g-b-qwen3-asr-spike-results.md) · `bash scripts/r3g-b-qwen3-asr-spike-hand-test.sh`  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1 **R3g-B**（延后 · Nano 等扩展 SKU）  
> **前置**：**R3g-A ✅**（SenseVoice + Paraformer）；**R3e-B/C ✅**（长音频分窗 + async preview）  
> **关联 spec（编码前须链接本文）**：`r3g-b-qwen3-asr-sku-intent.md` / `…-plan.md` / `…-acceptance.md`（**仅 spike Go 后立项**）  
> **门禁**：未完成 spike §6 签收 **不得** 改 `LOCAL_ASR_MODEL_CATALOG` 与用户可见下拉

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 中文长音频（13～20min+）本机转写，需要 **多语段 + 标点 + 时间轴**；部分用户希望 **多语/方言** 或 **比 SenseVoice 更好的长音频分段**，又不想上云 STT |
| **行业变化（2026-04～05）** | [FunASR v1.3.3](https://github.com/modelscope/FunASR/releases/tag/v1.3.3) 正式接入 **Qwen3-ASR**（0.6B/1.7B）；[Qwen3-ASR 技术报告](https://arxiv.org/html/2601.21337v1) 中文 benchmark 优于 Whisper 一代量级 |
| **本仓现状** | R3g-A 仅 **SenseVoice** + **Paraformer-long-vad-punc**；`funasr_pipeline.py` 已对 `qwen` **跳过 ct-punc 管道**，但 **无 catalog 条目**、`AsrModelProfile` 仅 `generic_funasr_v1` |
| **Spike 成功标准** | 在 **不改用户 catalog** 前提下，用 env/源码侧车跑通 **Qwen3-ASR-0.6B**，并对照 Paraformer 完成 §5 指标表；产出 **Go / Defer / No-go** 结论 |

**关键路径（spike 期间）**

```text
# 不修改桌面 catalog；仅侧车 env
RUSHI_FUNASR_MODEL=Qwen/Qwen3-ASR-0.6B
  → prepare（若需 VAD 权重）→ POST /v1/transcribe 或 /v1/transcribe/async
  → transcribe_by_windows（≥30min 阈值时）
  → segments[] → 与 Paraformer 同样本 diff
```

**非目标（spike 内明确不做）**

- 不上环境面板第三项 SKU；不替换 Paraformer「长音频推荐」默认文案  
- 不引入 vLLM / `funasr-server` 替换 `rushi_asr` HTTP 面  
- 不接 Qwen3-ForcedAligner（另立 spike，见 §4.2）  
- 不改 SQLite / L2–L3 真源；不启动 STREAM / Realtime WS

---

## 2. 业内成熟路线（≥3）

### A. FunASR 工具链内嵌 Qwen3-ASR（首选 spike 路径）

| 项 | 内容 |
|----|------|
| **代表** | [FunASR v1.3.3](https://github.com/modelscope/FunASR/releases/tag/v1.3.3)、[HF Qwen3-ASR + FunASR 讨论](https://huggingface.co/Qwen/Qwen3-ASR-1.7B/discussions/24) |
| **机制** | `AutoModel(model="Qwen/Qwen3-ASR-0.6B", hub="hf", trust_remote_code=True, vad_model="funasr/fsmn-vad")` → `generate()`；端到端 ASR，**不**走 Paraformer 的 ct-punc 外挂 |
| **与 Rushi** | **与 ADR-0003 FunASR-first 一致**；复用现有侧车、`prepare`、R3e 窗循环 |

### B. 独立 Qwen3 推理栈（qwen-asr / vLLM）

| 项 | 内容 |
|----|------|
| **代表** | Qwen 官方 `qwen-asr[vllm]`；FunASR 文档 **vLLM batch 340× RTF**（Fun-ASR-Nano） |
| **机制** | 独立服务或 batch 推理；与 `rushi_asr` 单进程 Job 模型不同 |
| **与 Rushi** | **spike 不采纳**；若 Go 且 GPU 用户占多数，可 **R3g-B2** 另立项 |

### C. 换引擎（Whisper / Parakeet / MiMo）

| 项 | 内容 |
|----|------|
| **代表** | Whisper-large-v3-turbo；NVIDIA Parakeet-TDT（25 欧语）；[MiMo-V2.5-ASR](https://github.com/XiaomiMiMo/MiMo-V2.5-ASR) |
| **与 Rushi** | 违背 **R3g FunASR SKU** 与 **中文长音频主路径**；**不纳入本 spike** |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 |
|------|--------|----------|-------------------|
| **A FunASR+Qwen3** | **高** | `model_catalog` 扩展模式、`prepare(async)`、`transcribe_windows.py`、R3e-C Job | 磁盘 **~5GB** 预算；PyInstaller + `trust_remote_code` |
| **B vLLM** | 低 | — | 第二套运行时；Windows CUDA 包体积 |
| **C 换引擎** | 低 | — | ADR-0003、双引擎维护 |

**本仓必须先复用**

| 模块 | 路径 | Spike 用法 |
|------|------|------------|
| 无 punc 管道判定 | `funasr_pipeline.py`（`qwen` 分支） | 确认 prepare **不**拉 ct-punc |
| Generate Profile | `asr_model_profile.py` | Spike 可能补 `qwen3` family；**spike 前仅 generic** |
| 长音频窗循环 | `transcribe_windows.py` | 同 Paraformer 路径对比 |
| Async preview | R3e-C Job API | 可选：同样本 async final ≡ blocking |
| Catalog 模式 | `model_catalog.py` + `localAsrModelCatalog.ts` | **Go 后**才加一行 |
| 手测样本 | R3g ⑤c 13min、R3e-C ~20min | §5 对照基准 |

---

## 4. 决策摘要（spike 前假设）

| 问题 | 结论 |
|------|------|
| **Spike 模型** | **Qwen3-ASR-0.6B** 优先；1.7B 仅当 0.6B **Go 且**质量瓶颈明确 |
| **Hub id（待 spike 确认）** | `Qwen/Qwen3-ASR-0.6B`（与 FunASR 1.3.3 文档对齐；以 `funasr AutoModel` 冒烟为准） |
| **VAD** | 按 FunASR 示例挂 `funasr/fsmn-vad`；计入磁盘 |
| **不做什么** | ForcedAligner、catalog UI、vLLM、在线 STT |
| **与 ADR** | 不修改 **FunASR-first**；仅 **R3g-B 扩展 SKU** |
| **与 R3g-C** | 若 spike 进行中 **R3g-C Profile** 合入，spike 分支基于 **合入后** `asr_model_profile.py` 复测 |

### 4.1 Go / No-go 阈值（硬闸门）

Spike 结论必须对照下表（**全部满足** 才 **Go → R3g-B 产品化**）：

| # | 指标 | Paraformer 基准 | Qwen3-0.6B 要求 |
|---|------|-----------------|------------------|
| G1 | **13min 语段数** | ≥10（⑤c 已签收） | **≥10**，且无 `funasr_whole_track_fallback` |
| G2 | **20min 语段数** | 记录 baseline | **≥ baseline 的 90%** 或 **≥15**（取高） |
| G3 | **首段可见**（async 120s 窗） | 已有 R3e-C SLA | 首窗结束后 **≤60s** 见 ≥1 非空段 |
| G4 | **blocking vs async final** | 结构一致 | 同 wav **段数 ±10%**、首尾 `start_sec/end_sec` 差 **≤0.5s**；**窗边界无重复/格式泄漏**（见 §8 伪流式） |
| G5 | **热词**（`fixtures/eval` 制控样例） | `term_hit_rate` baseline | **不低于 baseline** |
| G6 | **磁盘增量** | — | recognizer+VAD **≤2.5GB**；与 SenseVoice+Paraformer **并存 ≤5GB** 或产品接受「互斥缓存」文案 |
| G7 | **侧车健康** | `/health` ready | `prepare` 完成 → `ready_for_transcribe`；PyInstaller **import 不 500** |
| G8 | **20min wall clock**（MPS 或 CUDA） | Paraformer 同机记录 | **≤1.5×** Paraformer 同机时间（CPU 路径单独记录，不阻塞 Go） |

**Defer**：G1–G5 通过但 G6/G7/G8 任一项失败 → 文档化 blocker，**不进 catalog**。  
**No-go**：G1 或 G2 失败（长音频不如 Paraformer）→ **关闭 R3g-B Qwen 线**，维持双 SKU。

### 4.2 Qwen3-ForcedAligner（不在本 spike）

| 项 | 说明 |
|----|------|
| **用途** | 文本–语音强制对齐、句/词级时间戳；**⑤″f-E 实测** Qwen3-ASR 无 Aligner 则 **0 语段** |
| **后续薄片** | [**R3g-B-Align** 调研](./r3g-b-align-qwen3-forced-aligner-spike-research.md)（**P2**，不挡 EXP-WORD） |
| **与本 spike 关系** | **禁止** 与 ASR SKU 同一 PR |

---

## 5. Spike 执行计划（2～4 人日）

### Phase 0 — 环境（0.5d）

```bash
# 源码侧车 venv（勿改 bundled 包直到 Phase 3）
pip install --upgrade "funasr>=1.3.3"
# 按 FunASR Qwen3 文档安装 trust_remote_code 依赖

export RUSHI_FUNASR_MODEL=Qwen/Qwen3-ASR-0.6B
# 启动：npm run asr:dev 或 python -m rushi_asr
```

- [ ] `GET /health` 含 `funasr_model_id` 与 `ready_for_transcribe`  
- [ ] 记录 FunASR / torch 版本到 spike 日志

### Phase 1 — 裸 transcribe 对照（1d）

| 样本 | 用途 | 路径/说明 |
|------|------|-----------|
| **S1** | R3g ⑤c | **13min** 中文；Paraformer vs Qwen3 |
| **S2** | R3e-C | **~20min** 中文；async 120s 窗 + 首段可见 |
| **S3** | 热词 | `fixtures/eval/samples/制控.mp3`（或仓库等价） |
| **S4** | 短音频 | ≤3min；回归无窗路径 |

每条样本记录：

- 语段数、首/末段时间、首段 text 前 80 字  
- warnings 列表（含 `funasr_whole_track_fallback`）  
- wall clock、峰值 RSS（`/usr/bin/time -l` 或侧车日志）

### Phase 2 — Rushi 链路（1d）

- [ ] `POST /v1/transcribe` blocking 全绿  
- [ ] `POST /v1/transcribe/async` + poll → finalize（[`r3e-c-hand-test.sh`](../../../scripts/r3e-c-hand-test.sh) 改 `RUSHI_FUNASR_MODEL`）  
- [ ] 取消：`POST /v1/transcribe/cancel`  mid-job（R3e-C Phase 2）  
- [ ] 若 `build_generate_kwargs` 需 `language=auto` / ITN：仅 **spike 分支** 试参，合入前走 R3g-C 闸门

### Phase 3 — 打包探测（0.5d，可并行 Phase 2）

- [ ] bump `requirements-sidecar-*.lock` + `funasr>=1.3.3`  
- [ ] `npm run asr:build-sidecar-unix` → bundled `/health`  
- [ ] 记录 onedir 体积增量；`check-architecture-guard` 无新 error

### Phase 4 — 结论（0.5d）

填写 §6 签收 + 一页表格（粘贴 §4.1 实测值）。

---

## 6. 落位预告（仅 spike **Go** 后）

| 层 | 文件 | 变更 |
|----|------|------|
| Python | `model_catalog.py` | `catalog_id=qwen3-asr-0.6b` |
| Python | `asr_model_profile.py` | `sku_family=qwen3` + kwargs |
| Python | `funasr_engine.py` | 若需 `trust_remote_code` / hub 参数 |
| TS | `localAsrModelCatalog.ts` | 同步 catalog 行 + diskHint |
| TS | `hubModelNeedsPuncPrepare` | Qwen **无需** punc prepare |
| 锁文件 | `requirements-sidecar-*.lock` | funasr≥1.3.3 |
| 文档 | `r3g-local-asr-model-catalog-acceptance.md` | R3g-B 切片 |
| 测试 | `test_funasr_engine.py`、catalog 单测 | profile + prepare 探测 |

**预估产品化**：**3～5d**（在 spike Go 且 R3g-C 已签收后插入 §4.1.1）。

---

## 7. 与 Fun-ASR-Nano 的排序

| 候选 | Spike 触发条件 | 建议顺序 |
|------|----------------|----------|
| **Qwen3-ASR-0.6B** | 中文长音频 **质量** / 多语 | **先做**（本 brief） |
| **Fun-ASR-Nano + vLLM** | CUDA 用户 **速度** | Qwen Go/No-go 后再 spike |

二者同属 **R3g-B**；**不要**同一 PR 双 SKU 上架。

---

## 8. 风险

| 风险 | 缓解 |
|------|------|
| 0.6B 长音频仍单段 | No-go；不强行 catalog |
| 磁盘超 5GB | Defer；UI「互斥缓存」或只保留单 SKU 推荐 |
| PyInstaller `remote_code` 失败 | Defer 至 R3h 打包策略更新 |
| FunASR 1.3.3 与当前 lock 冲突 | Phase 3 单独 PR bump lock（→ **R3h-ASR-VER**） |
| 与 R3g-C 并行改 `asr_model_profile.py` | spike 分支 rebase 后 **重跑 S1/S2** |
| **Qwen3「伪流式」** | FunASR/Qwen3 流式实现 reportedly **每 chunk 从头处理、无跨段上下文**（社区 issue #129 类报告：边界重复、格式 token 泄漏）。Rushi **batch + R3e-C Job** 不依赖 WS 流式，但 **G4 须加严**：20min 样本对比 blocking final vs async final **段界无重复文本**；若窗边界重复率 >5% → **Defer** 或 No-go |
| **SenseVoice 平台弃用** | 百炼等平台标记 SenseVoice approaching deprecation；catalog **保留** SKU，R3g-C **去「推荐」**；Qwen3 Go 后可调整默认位 |

---

## 9. 验证命令（spike 签收）

```bash
# Python 回归（spike 分支）
pytest services/asr/tests/test_funasr_engine.py services/asr/tests/test_transcribe_windows.py services/asr/tests/test_transcribe_job.py

# 手测脚本（async env）
bash scripts/r3e-c-hand-test.sh

# 若 bump lock / 打包
npm run asr:build-sidecar-unix
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

---

## 10. 签收

### Spike 产出物

- [ ] §4.1 指标表填实测值  
- [ ] 结论：**Go / Defer / No-go** 之一 + 一句话理由  
- [ ] 若 Go：起草 `r3g-b-qwen3-asr-sku-intent.md` 链接本文  

### 门禁

- [x] 调研 brief 完成（2026-05-30）  
- [ ] spike 执行完成（清单 + results 表；**EXP-WORD 前必过**）  
- [ ] 用户或路线图确认是否进入 R3g-B 产品化  

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-05-30 | 初版：Qwen3-ASR-0.6B spike 范围、Go/No-go 阈值、样本与阶段 |
| 2026-05-30 | §8 新增 Qwen3 伪流式 / SenseVoice 弃用风险；G4 加严窗边界重复 |

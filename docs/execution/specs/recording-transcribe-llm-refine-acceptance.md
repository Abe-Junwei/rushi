# Acceptance: R3t — 录音转写 · 声学分段 · LLM 校准

> **状态（2026-06-04）**：**R3t-A/B/C/D ✅**；**R3t-E** ❌ 已从产品移除（2026-06）  
> **Intent**：[`recording-transcribe-llm-refine-intent.md`](./recording-transcribe-llm-refine-intent.md)  
> **Plan**：[`recording-transcribe-llm-refine-plan.md`](./recording-transcribe-llm-refine-plan.md)  
> **路线图索引**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.2、§13

## Epic 签收条件（全部子阶段完成后）

- [x] 录音文件「拉取语段」主路径可重复手测通过（短音频 + 13min）— 2026-05-30 API 手测（见 §R3t-A 手测记录）
- [x] LLM 标点（R3t-C）、段界（R3t-D）预览确认，取消不改库 — 2026-05-31
- [x] ~~**词表校对（R3t-E）**~~ 已从产品移除（2026-06）
- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`（2026-05-30：567 vitest，0 守卫 error）
- [ ] 动 Rust 时 `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`（R3t 全 Epic 签收时跑全量）
- [x] 架构守卫无新增 error（2026-05-30）

---

## R3t-A — 声学分段 ASR

> **编码真源（已合入 `main`）**：`services/asr/rushi_asr/segmentation.py`、`funasr_engine.py`；桌面 `segmentation_mode` + `deriveTranscribeHints` / `segmentListHelpers`（`whole_track_fallback` → `kind: placeholder`）。

### 自动

- [x] `services/asr/tests/test_funasr_engine.py`：句级解析（含 ms/s 归一、`start=0`）、Paraformer `sentence_timestamp` / `merge_vad`、长音频禁 whole-track 终态、短音频 fallback、`segment_audio` 别名  
  验证：`python3 -m pytest services/asr/tests/test_funasr_engine.py -q`
- [x] `test_funasr_pipeline.py`：`recognizer_needs_punc_pipeline`、`effective_funasr_punc_model_id`  
  验证：`python3 -m pytest services/asr/tests/test_funasr_pipeline.py -q`
- [x] `test_model_prepare.py`：Paraformer 需 punc 纳入 `required_models_cached_guess`  
  验证：`python3 -m pytest services/asr/tests/test_model_prepare.py -q -k punc`
- [x] 桌面 hints 单测：`asrTranscribeHints.test.ts` 覆盖 `funasr_whole_track_fallback` 横幅文案

### 手测

- [x] **Paraformer + 13min**：≥10 条语段；无仅 0～全长 1 条（除非用户知悉 fallback）  
  _2026-05-30：`bash scripts/r3t-a-hand-test.sh` → **28** 段，`warnings: []`，798.7s 素材 `3de9484d-…mp3`；侧车 Paraformer + punc 已缓存。_
- [x] **SenseVoice + 13min**：≥3 条语段（VAD 级可接受）  
  _2026-05-30：同素材 Python 直调 SenseVoice → **41** 段，`segmentation_mode: vad_timestamp`，含 `funasr_long_audio_no_segments`（长音频无句级，非整轨 fallback）。_
- [x] **短音频 30s**：1～5 段均可接受；无崩溃  
  _2026-05-30：自 13min 素材截取 30s → **1** 段，无 error。_
- [x] 响应 `warnings` 含 `funasr_whole_track_fallback` 时，桌面 hints 出现对应横幅  
  _2026-05-30：SenseVoice `zh.mp3`（5.6s）触发 `funasr_whole_track_fallback`；`asrTranscribeHints.test.ts`「whole-track fallback」通过（横幅文案与 `deriveTranscribeHints` 一致）。_

### 非目标

- [x] 不在此阶段签收 mic/流式（未编码）

### R3t-A 切片签收（编码 + 手测）

- [x] **自动项**（上表）— 2026-05-30
- [x] **手测项**（上表）— **2026-05-30 签收**；下一刀 **R3t-B**

### R3t-A 手测记录（2026-05-30）

| 场景 | 素材 | 结果 |
|------|------|------|
| Preflight | `bash scripts/r3g-s3-preflight.sh` | ✅ Paraformer active，punc cached |
| Paraformer 13min | `3de9484d-…mp3`（798.7s） | 28 段；无 `funasr_whole_track_fallback` |
| SenseVoice 13min | 同上 | 41 段；`vad_timestamp`；无整轨 fallback |
| Paraformer ~30s | ffmpeg 自截 30s | 1 段 |
| whole_track_fallback | SenseVoice `zh.mp3` | warning + hints 单测 ✅ |

脚本：`bash scripts/r3t-a-hand-test.sh`；产物目录 `/var/folders/.../r3t-a-hand-test-20260530-202200`（本机 tmp）。

```text
改动：R3t-A 声学分段手测（Paraformer 13min + SenseVoice 长音频 + 短音频 + hints）
验证：r3g preflight + r3t-a-hand-test.sh；28/41/1 段；asrTranscribeHints whole-track 单测
下一轮：R3t-B 转写任务状态与原子写库
```

---

## R3t-B — 转写任务与落库

> **状态（2026-05-30）**：**编码 ✅**；**手测签收 ✅**（自动化 + hook 代理；UI 三项见 [`r3t-b-hand-test-checklist.md`](./r3t-b-hand-test-checklist.md)）

### 自动

- [x] Rust/TS 单测：segments 解析；空 segments；gate；vocabulary；`useTranscribeJobController`
- [x] `bash scripts/r3t-b-hand-test.sh` — 31 vitest + 11 cargo + 侧车 smoke

### 手测

- [x] 拉取前：D1≠D2 阻断（gate + preflight 单测 + live /health 模拟）
- [x] 转写中：busy 文案（`ProjectStatusFeedback` + controller `beginBusy(transcribe)`）
- [x] 成功后：SQLite 持久化（app DB 1014 segments + 侧车 short transcribe 契约）
- [x] 失败：旧语段不被覆盖（`error` payload 在 `save` 前 `return Err`；停侧车 UI 可选复验）
- [x] 覆盖已有语段：Q1 确认（`useTranscribeJobController` overwrite hook 单测）

### 手测记录

```text
改动：R3t-B 转写编排手测（preflight / busy / Q1 / 原子落库）
验证：bash scripts/r3t-b-hand-test.sh；31 vitest + cargo gate/parse；Paraformer live short 2 段
下一轮：R3t-C LLM 标点（R9 Mid 硬门禁）
```

### 能力—UI 状态矩阵

| UI | 维度 | 数据源 |
|----|------|--------|
| 拉取语段按钮可用 | D1=D2 且 D4 | `computeLocalAsrTranscribeReady` |
| 转写进度 | 任务态，非 D5 | `useTranscribeJobController` 或 lifecycle |
| 完成提示 | 段数 + warnings | 转写结果 |

### 矛盾场景手测（R3-STATE）

1. 已选 Paraformer、侧车仍为 SenseVoice → **不得**显示「拉取成功」且无警告。  
2. 全局 `ready_for_transcribe=true` 但所选模型未缓存 → **不得**启用拉取。

---

## R3t-C — LLM 标点（扩展 R2）

> **状态（2026-05-30）**：**编码 ✅ · 手测签收 ✅**；邻段上下文 + UI 提示；见 [`r3t-c-hand-test-checklist.md`](./r3t-c-hand-test-checklist.md)

### 自动

- [x] `neighbor_context`（prev/next）+ Rust prompt 标注「上一语段/下一语段」
- [x] `autoPunctuateNeighbors` + `useAutoPunctuateController` + `postprocess_cmd` 单测
- [x] `AutoPunctuatePreviewDialog` 展示 `含邻段上下文（…）`

### 手测

- [x] 单段标点：与 R2 一致，取消不改（DeepSeek 手测 + 日志）
- [x] 带邻段上下文：UI 摘要 + 请求 `neighbor_context`（单测 + 手测）
- [x] 首次使用隐私明示（controller 单测；R2 对话框复用）

### 手测记录

```text
改动：R3t-C 邻段上下文标点签收（prev/next + UI 摘要 + LLM 探测/标点）
验证：bash scripts/r3t-c-hand-test.sh；desktop.log postprocess_auto_punctuate_done
下一轮：R3t-D 段界 ops
```

---

## R3e-B — 长音频分窗转写

> **状态（2026-05-31）**：**编码 ✅ · 手测签收 ✅** — [`r3e-b-hand-test-checklist.md`](./r3e-b-hand-test-checklist.md)、[`r3e-long-audio-transcribe-acceptance.md`](./r3e-long-audio-transcribe-acceptance.md)

### 自动

- [x] `test_transcribe_windows.py` + Profile + `bash scripts/r3e-b-hand-test.sh`

### 手测

- [x] ~48.6min（2918s）Paraformer：`transcribe_stage=preflight→parse→save`，墙钟 ~61s
- [x] warnings / hints：`transcribe_windowed:windows=10`
- [x] 短音频回归（同会话历史 log）

---

## R3t-D — LLM 语义段界

> **状态**：✅ **2026-05-31 手测签收** — [`r3t-d-hand-test-checklist.md`](./r3t-d-hand-test-checklist.md)

### 自动

- [x] ops 校验：非法 split 点拒绝；merge uid 不存在拒绝（`postprocess_segment_ops` + Vitest）
- [x] apply 后：时间单调（`segmentRefineApply` + Vitest）

### 手测

- [x] **merge / update_text**：LLM 建议合并邻段 + 改字；确认写回后语段条数/正文符合预期
- [ ] **split**：一条段中点拆分，波形上两条可独立拖动（可选补测）
- [x] **取消 / 未确认**：不写回或写回前取消，与 ASR 原文一致
- [x] 预览 UI：时间+正文摘要（非裸 uid）；`startSec` 请求字段对齐

---

## R3t-E — 词表有据校对（Lexicon-guided）

> **调研**：[`r3t-e-lexicon-proofread-research.md`](./r3t-e-lexicon-proofread-research.md)  
> 架构：[`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)  
> **手测清单**：[`r3t-e-hand-test-checklist.md`](./r3t-e-hand-test-checklist.md) · **⑤″f-A 追踪**：[`r3-5f-a-phase-signoff-2026-06.md`](./r3-5f-a-phase-signoff-2026-06.md)

### 自动

- [x] `lexicon_pack` 组装单测：glossary 列表、memory rules 权重、截断标记
- [x] 响应校验：无 Pack 内依据的 op 被丢弃（`postprocess_lexicon_ops`）
- [x] `useLexiconProofreadController` 契约测试（mock `postprocessLexiconProofread`）
- [x] `parse_lexicon_proofread_json` 单测（含 markdown fence）

### 手测

- [ ] 术语表含 canonical「安那般那」，语段 ASR 为「安波那那」→ 校对建议改正，依据显示 **术语表/规则**
- [ ] 同一窗口两段分别用「涅槃」「涅盘」，建议统一，依据类型 **inconsistent_term**
- [ ] 取消预览：文本不变；确认后 `correction_memory` 可学习（保存语段）
- [ ] 可选：「采纳为纠错规则」后，下次转写出现 `correction_rule_hint`（与 P2 一致）
- [ ] 隐私文案含「词表条目将发送至云端」

### 与 L2 分工手测

- [ ] 仅加 glossary、先 **不跑 E**：转写 hotwords 路径仍正常（P2/GLY-1 回归）
- [ ] 跑 E **不重复转写**：改正仅来自 LLM 预览确认

---

## 与 R3g / R3e 关系（避免重复签收）

| 原切片 | R3t 接管部分 | 2026-05-30 口径 |
|--------|----------------|-----------------|
| R3g-A ⑤c 多语段 | → **R3t-A** 手测 | ⑤c ✅；R3t-A 手测清单仍须 **正式勾选** |
| R3e-A 超时 | 横切 **R3t-B**；e-A 可单独先签 | `transcribe_timeout.rs` 编码✅；50min 手测⏳ |
| R3e-B 分段 | 与 **R3t-A/B** 合并评审后签 | ✅ 2026-05-30 — [`r3e-b-hand-test-checklist.md`](./r3e-b-hand-test-checklist.md) |

---

## 日志模板（每轮手测 3 行）

```text
改动：<子阶段>
验证：<命令 + 手测路径>
下一轮：<子阶段或 STREAM 规格>
```

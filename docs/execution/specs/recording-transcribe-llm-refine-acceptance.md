# Acceptance: R3t — 录音转写 · 声学分段 · LLM 校准

> **状态**：规划定稿；**签收项均未开始**  
> **Intent**：[`recording-transcribe-llm-refine-intent.md`](./recording-transcribe-llm-refine-intent.md)  
> **Plan**：[`recording-transcribe-llm-refine-plan.md`](./recording-transcribe-llm-refine-plan.md)

## Epic 签收条件（全部子阶段完成后）

- [ ] 录音文件「拉取语段」主路径可重复手测通过（短音频 + 13min）
- [ ] LLM 标点（R3t-C）、段界（R3t-D）、**词表校对（R3t-E）** 均有预览确认，取消不改库
- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- [ ] 动 Rust 时 `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- [ ] 架构守卫无新增 error

---

## R3t-A — 声学分段 ASR

### 自动

- [ ] `services/asr/tests/test_funasr_engine*.py` 覆盖：句级解析、`start=0`、Paraformer generate 参数、punc 需 cached
- [ ] `test_funasr_pipeline.py` / `test_model_prepare.py` 覆盖 punc 纳入 `required_models_cached_guess`

### 手测

- [ ] **Paraformer + 13min**：≥10 条语段；无仅 0～全长 1 条（除非用户知悉 fallback）
- [ ] **SenseVoice + 13min**：≥3 条语段（VAD 级可接受）
- [ ] **短音频 30s**：1～5 段均可接受；无崩溃
- [ ] 响应 `warnings` 含 `funasr_whole_track_fallback` 时，桌面 hints 出现对应横幅

### 非目标

- [ ] 不在此阶段签收 mic/流式

---

## R3t-B — 转写任务与落库

### 自动

- [ ] Rust/TS 单测：segments 解析；空 segments 行为；超时推导（若与 e-A 合并）

### 手测

- [ ] 拉取前：D1≠D2 时阻断或强提示（与 R3-STATE 一致）
- [ ] 转写中：busy + 可理解阶段文案
- [ ] 成功后：语段列表与波形对齐；保存重启仍在
- [ ] 失败：旧语段不被半成品覆盖
- [ ] 覆盖已有语段时：有确认（若 Q1 采纳）

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

### 自动

- [ ] `postprocess_cmd` 邻段字段回归；`useAutoPunctuateController` 测试

### 手测

- [ ] 单段标点：与 R2 一致，取消不改
- [ ] 带邻段上下文：输出合理率抽测 ≥8/10
- [ ] 首次使用隐私明示

---

## R3t-D — LLM 语义段界

### 自动

- [ ] ops 校验：非法 split 点拒绝；merge uid 不存在拒绝
- [ ] apply 后：时间单调、无重叠

### 手测

- [ ] **merge**：两条相邻段合并为一条，时间跨度正确，uid 策略符合 plan
- [ ] **split**：一条段中点拆分，波形上两条可独立拖动
- [ ] **拒绝预览**：数据库与 ASR 原文一致
- [ ] 云端失败：无部分应用

---

## R3t-E — 词表有据校对（Lexicon-guided）

> 架构：[`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)

### 自动

- [ ] `lexicon_pack` 组装单测：glossary 列表、memory rules 权重、截断标记
- [ ] 响应校验：无 Pack 内依据的 op 被丢弃
- [ ] `postprocess_lexicon_proofread` 契约测试（mock HTTP）

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

| 原切片 | R3t 接管部分 |
|--------|----------------|
| R3g-A ⑤c 多语段 | → **R3t-A** 手测 |
| R3e-A 超时 | 横切 **R3t-B**；e-A 可单独先签 |
| R3e-B 分段 | 与 **R3t-A/B** 合并评审后签，避免测两遍 |

---

## 日志模板（每轮手测 3 行）

```text
改动：<子阶段>
验证：<命令 + 手测路径>
下一轮：<子阶段或 STREAM 规格>
```

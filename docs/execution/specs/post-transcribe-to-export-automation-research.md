# 调研：转写后 → 导出前的自动化能力（F0 编排）

> **状态**：调研 brief（2026-06-04；**2026-06-05 修订**：阶段 A 扩充 + 用户主路径 A→B→手改→导出）  
> **范围**：语段 **已落库（L3）** 至 **导出（L6）**。  
> **产品决策**：R3t-C/D **独立菜单已移除**；标点/段界 **不** 以工具栏批处理回归。  
> **用户主路径（真源）**：拉取语段 → **阶段 A（确定性）** → **阶段 B（LLM 改稿）** → 手动改稿 → 导出。  
> **顺序**：**A 必须在 B 之前**（见对话定稿）。  
> **关联**：[`r3t-f-post-transcribe-suite-plan.md`](./r3t-f-post-transcribe-suite-plan.md) · [`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md) · [`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md) · [`r3t-f-correction-memory-optimization-plan.md`](./r3t-f-correction-memory-optimization-plan.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 转写落库后：先用 **可重复、可预览** 的规则层清掉「已知错形」；再用 **一轮 LLM** 补标点/错字等；再进编辑器手改与导出。 |
| **本仓现状** | **阶段 A 核心已落地**：F1 / MEM-P2（`list_stable_correction_rules` + 字面最长优先替换 + 预览写回）。**阶段 B** 后端仍在（`postprocess_auto_punctuate` 等），**无** F0 编排。L2 `correction_rule_hint:*` 仅 warning，不写回。 |
| **本次调研焦点** | **阶段 A 还可包含哪些子能力**、业内怎么做、与 L0/L2/B/手改 的边界。 |

---

## 2. 端到端阶段模型（修订）

```text
[L0–L2 转写]  hotwords · ASR · VAD 段 · warnings
[L3 落库]     segments[] stable
    ↓
┌─ 阶段 A：确定性「转写后规则层」（F0 步骤 1，必须在 B 前）────────────┐
│  A1 稳定纠错记忆全文替换（F1 / MEM-P2）← v1 核心                    │
│  A2–A7 见 §3（ hygiene / 词表形 / 冲突报告 / hints 升级等）           │
└────────────────────────────────────────────────────────────────────┘
    ↓
┌─ 阶段 B：LLM 改稿（F0 步骤 2，预览写回）────────────────────────────┐
│  标点 + 错字（一轮或两轮 prompt；不进 A）                              │
└────────────────────────────────────────────────────────────────────┘
    ↓
  手动改稿（F2、逐段、记忆学习 F6）
    ↓
  导出（可选 L6 export_polish，与 B 分离）
```

**边界（硬）**

| 层 | 属于 | 不属于 |
|----|------|--------|
| **L0/L2** | 转写前/中：hotwords、`keyterms` 类偏置 | 阶段 A（语段尚未 stable 或不应改库） |
| **阶段 A** | 表驱动替换、WFST/正则类、只读报告 | LLM、改段界、静默写库 |
| **阶段 B** | 标点、语境错字、轻润色 | 稳定规则全文替换（应已完成） |
| **手改** | F2、采纳为规则、F6 | 并入 A 的批量静默 |

---

## 3. 阶段 A 能力 taxonomy（详细规划）

### 3.1 分层原则

1. **可确定性**：同样输入 + 同样词表 → 同样输出（可单测）。  
2. **可预览**：写回前必须 diff；用户拒绝则不落库。  
3. **不抢 LLM 职责**：标点、句法、同音异字 **无表** 的歧义 → **B**，不进 A。  
4. **不重复 L0**：`correction_memory.before` **永不** 进 hotwords（[`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md) §6）。

### 3.2 子步骤一览

| ID | 名称 | 机制 | 本仓 | 建议纳入 A | 优先级 |
|----|------|------|------|------------|--------|
| **A1** | **稳定纠错规则全文替换** | `wrong→right`，`hit≥3` 或 `accepted_as_rule`，段内字面最长优先，上限 80 条 | ✅ F1、`offerPostTranscribeStableRules` | **是（v1 核心）** | P0 |
| **A2** | **转写后规则命中报告（只读）** | 汇总：将改 N 段、M 条规则；未命中 stable 的 `hit=1/2` 条数 | 部分（空规则 dialog） | **是**（与 A1 同屏） | P0 |
| **A3** | **L2 hints 与 A1 去重展示** | 转写 warnings 中 `correction_rule_hint:*` 已在 A1 覆盖的标「将一并应用」 | ✅ `collect_correction_rule_hints` | **是**（文案/清单，不二次写回） | P1 |
| **A4** | **同 before 多 after 冲突预览** | 导入/记忆冲突：选保留哪条 | F7 D6；MEM-P3 编辑台 | **是**（应用前阻塞或折叠区） | P1 |
| **A5** | **术语表 DisplayAs / 别名 → canonical** | 仅当正文 **字面含** alias 且 **不含** term 时替换（非同音） | ❌ Plan 明确 F1 **不做** glossary 全自动 | **Spike**（易误伤，需白名单） | P2 |
| **A6** | **文本 hygiene** | NFKC、全半角、连续空格、重复标点压缩 | ❌ | **可选子包 A6** | P2 |
| **A7** | **ITN 轻量规则** | 中文数字/日期/百分号等 **规则表**（非 NeMo 全量） | 侧车/ASR 部分 ITN 未统一 | **Spike**（与 B 标点重叠需切边界） | P3 |
| **A8** | **MEM-S1 转写落库前预替换** | 与 A1 同 SQL，在 L3 前写 segments | 📋 Spike [`correction-memory-optimization-plan`](./r3t-f-correction-memory-optimization-plan.md) §7 | **若启用则 A 仅 diff 复核** | Spike |
| **A9** | **词表卫生只读（F8 前移）** | 导出前检查前移：hit=1 噪声、orphan rule、条数预估 | 📋 F8 候选 | **A 末尾只读面板**，不写回 | P2 |
| **A10** | **敏感词/禁用词替换** | 企业合规表 | ❌ | 不做 v1 | — |
| **A11** | **去口语填充词** | 「嗯、啊」删除 | 需音频或 LLM；Descript 用音频工具 | **不进 A** | — |

### 3.3 明确不进阶段 A

| 能力 | 归位 |
|------|------|
| R3t-C 自动标点、R3t-D 段界 | 产品菜单移除；**标点/段界若需要** → **阶段 B** 编排，不恢复独立 C/D 入口 |
| R3t-E 词表 LLM 校对 | **阶段 B**（带 LexiconPack + evidence），非 A |
| F2 查找替换 | 手动改稿 |
| F6 / 保存 infer / 第三次进术语表 | 编辑期背景 |
| 导出 DOCX `export_polish` | L6 |
| glossary → hotwords | **L0**（改善 **下次** 转写，不改当前稿） |

### 3.4 阶段 A 内推荐执行顺序（子流水线）

```text
A2/A9 只读摘要（可选，先让用户知道「有没有活」）
  → A4 冲突门禁（有冲突则先决，再替换）
  → A1 稳定规则预览 + 确认写回
  → A3 标记 hints 已覆盖（ informational ）
  → （未来）A5/A6/A7 若立项，插在 A1 之前或之后见 §6.2
```

**默认 v1**：仅 **A1 + A2**（合并 MEM-P2 与 F1 单对话框）。

---

## 4. 业内成熟路线（≥4）

| # | 路线 | 代表 | 机制 | 与 Rushi 阶段 A 对照 |
|---|------|------|------|----------------------|
| **1** | **Custom Spelling / 转写后确定性替换** | [AssemblyAI Custom Spelling](https://www.assemblyai.com/docs/pre-recorded-audio/correct-spelling-of-terms) | API 参数 `from[] → to`，**不依赖 LLM**；与 `keyterms_prompt`（L0）分离 | ≈ **A1**；Rushi 用 `correction_memory` 而非 API 侧 spelling |
| **2** | **Custom Dictionary + 当前稿批量替换** | [Sonix Custom Dictionary](https://help.sonix.ai/en/articles/2789309-can-i-add-specific-words-or-phrases-to-sonix-to-make-my-transcript-more-accurate) + [Find & Replace](https://help.sonix.ai/en/articles/1756243-how-do-i-use-sonix-s-find-replace-feature) | 词典改善 **未来** 转写；**当前文件** 用 Replace All（用户触发） | 词典 ≈ L0 glossary；Replace All ≈ **F2**；Rushi **A1** 把「词典级稳定 memory」自动化到转写后一步 |
| **3** | **Transcription Glossary（转写前）+ 编辑学习** | [Descript Transcription Glossary](https://help.descript.com/hc/en-us/articles/10249407290637-Transcription-glossary) | ≤30 词/ Drive；**同形改 3 次** 自动进表；**当前稿** 仍手改 | ≈ L0 + MEM-P0 进表；**无** 转写后一键规则层 → Rushi **A1** 是差异点 |
| **4** | **Dictionary-first, AI-second** | [transcript-fixer](https://github.com/daymade/claude-code-skills/blob/main/transcript-fixer/SKILL.md) | Stage1 词典 **instant** → Stage2 AI；词典 false positive 则回滚原文再 AI | 强印证 **A→B**；Rushi A1 应对标 Stage1 |
| **5** | **WFST ITN / 可读化** | [NeMo ITN](https://github.com/NVIDIA/NeMo-text-processing)、[NVIDIA Riva ASR customizing](https://docs.nvidia.com/deeplearning/riva/user-guide/docs/asr/asr-customizing.html) | 数字/货币/日期 **spoken→written**；可部署为 ASR 后处理 | ≈ **A7**；与云端 `format_text`/标点部分重叠 → 需划界，避免与 **B** 重复 |
| **6** | **流式 turn 级 keyterms 二次 pass** | [AssemblyAI keyterms 文档](https://www.assemblyai.com/docs/streaming/keyterms-prompting) | turn 完成后 **再 boost** 一轮 | 偏 L0/L2；**非** 用户稿字面替换，不进 A |

**竞品 LLM 放哪**：AssemblyAI 默认 **ASR 内** 标点/ITN（[`format_text` / punctuate](https://www.assemblyai.com/blog/boosting-transcript-readability-with-automatic-punctuation-and-casing-and-itn)）≈ 厂商侧 L2；用户自定义 **post-processing** 仍建议规则优先 — 与 Rushi **A→B** 一致。

---

## 5. 可复用评估

| 子能力 | 复用度 | 可直接用 | 冲突 / 风险 | 进度 UX |
|--------|--------|----------|-------------|---------|
| A1 稳定规则 | **高** | `correctionStableRulesList` + `buildSegmentCorrectionChanges` | 子串误伤；长句性能 | 已有预览 dialog |
| A3 hints 合并展示 | **高** | `collect_correction_rule_hints` | 与 A1 重复写回 | 仅列表 |
| A4 冲突 | **中** | F7 `lexicon_bundle` 冲突 UI 逻辑 | 阻塞感 | 需明确「解决后再应用」 |
| A5 glossary→正文 | **低** | `glossary_terms` + aliases | 同音形错误替换 | 必须预览 |
| A6 hygiene | **中** | 新纯函数 | 改变字节长度影响时间轴？**仅 text** | 一步 diff |
| A7 ITN | **低** | NeMo 太重；可摘小规则 | 与 B 标点重复 | 分批 |
| A8 MEM-S1 | **中** | `list_stable_correction_rules` Rust | 与 A1 双写 | 转写进度条内 |

**本仓必复用（禁止第二套真源）**

- 规则 SQL：`list_stable_correction_rules` / `collect_correction_rule_hints`（同源阈值 `CORRECTION_MEMORY_STABLE_HIT = 3`）  
- 预览写回：`useCorrectionRulesController` + `CorrectionRulesPreviewDialog`  
- 热词：`glossary_hotwords.rs`（仅 L0，不进 A 替换错形）

---

## 6. 决策摘要

| 问题 | 结论 |
|------|------|
| **阶段 A v1 包含什么** | **A1 + A2**（= 合并 F1 与 MEM-P2 单入口单预览）；文案统一为「转写后处理 · 规则」 |
| **阶段 A v1.5** | **A3** hints 清单 + **A4** 冲突门禁（与 F7 复用） |
| **阶段 A v2 候选** | **A5** glossary alias（spike）、**A6** hygiene、**A9** F8 只读前移 |
| **A8 MEM-S1** | 若做：属 L3 边界 spike，**不** 与 A1 重复应用；A 变为「复核 diff」 |
| **阶段 A 不做** | LLM、段界、静默写库、hotwords 错形、去填充词、F2 正则 |
| **与 B 关系** | A 确认写回后再启 B；B 可消费写回后正文 + LexiconPack（规划） |

### 6.1 A5/A6/A7 若立项时的顺序建议

| 子能力 | 建议在 A1 前/后 | 理由 |
|--------|----------------|------|
| A6 hygiene | **A1 前** | 避免规则匹配到多余空白/全角 |
| A5 glossary alias | **A1 后** | 先 memory 再 canonical 表面形，减少表冲突 |
| A7 ITN | **A1 后、B 前** | 数字形固定后 LLM 只补标点/错字 |

### 6.2 F0 编排（相对旧「F0-lite 仅规则」）

| 步骤 | 类型 | 内容 |
|------|------|------|
| 1 | **阶段 A** | §3.2 v1：A1+A2（+v1.5 A3/A4） |
| 2 | **阶段 B** | LLM 标点 + 错字（预览；复用 postprocess 栈） |
| 3 | 手改 | F2、工具栏、记忆 |
| 4 | 导出 | 可选 export_polish |

---

## 7. 缺口与薄片建议

| 缺口 | 薄片 | 估时 |
|------|------|------|
| A 与 B 单入口编排 | `usePostTranscribeOrchestrationController` 或扩 F0 | 2–4d |
| A1+A2 合并（取消双弹窗） | 薄封装现有 `useCorrectionRulesController` | 0.5–1d |
| A3/A4 | 预览 UI 扩展 | 1–2d |
| B 统一 proofread prompt | Rust/TS spike | 3–5d |

---

## 8. 能力—UI 状态（阶段 A 矩阵草案）

| 状态 | 条件 | UI |
|------|------|-----|
| `rules_idle` | 无文件/无语段 | 转写后处理 disabled |
| `rules_loading` | 拉 stable 规则 + 算 changes | 对话框 loading |
| `rules_empty` | 无 stable 或无匹配 | 提示 + 可选「仍继续 LLM」 |
| `rules_preview` | 有 changes | diff 列表；确认/取消 |
| `rules_conflict` | A4：同 before 冲突 | 冲突区置顶，应用 disabled |
| `rules_applied` | 写回成功 | 进入 B 或关闭 |

---

## 9. 文档同步项

- [x] F0 三件套：[`f0-post-transcribe-orchestration-plan.md`](./f0-post-transcribe-orchestration-plan.md) · [acceptance](./f0-post-transcribe-orchestration-acceptance.md) · [手测](./f0-post-transcribe-hand-test-checklist.md)  
- [x] [`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) §P2 F0 指向 F0 acceptance  
- [ ] Plan §8 正文段落（若与 §3 套件索引重复可只保留链接）  
- [ ] [`r3t-f-correction-memory-optimization-plan.md`](./r3t-f-correction-memory-optimization-plan.md) MEM-S1 与 A1 关系写清  

---

## 10. 落位（编码时）

| 层 | 文件 |
|----|------|
| A 预览/写回 | `useCorrectionRulesController.ts`、`CorrectionRulesPreviewDialog.tsx` |
| A 规则 SQL | `correction_store.rs`、`correction_hints.rs` |
| F0 编排 | 新 controller + `finishTranscribeSuccess` 入口 |
| B | `postprocess_auto_punctuate_cmd.rs` + 待建 unified proofread |

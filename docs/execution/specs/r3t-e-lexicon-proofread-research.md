# R3t-E 调研：词表有据校对（Lexicon-guided LLM proofread）

> **状态**：已采纳（2026-05-31）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10 **⑤″e**  
> **关联架构**：[`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)  
> **关联 spec**：[`recording-transcribe-llm-refine-plan.md`](./recording-transcribe-llm-refine-plan.md) §6 · [`recording-transcribe-llm-refine-acceptance.md`](./recording-transcribe-llm-refine-acceptance.md) §R3t-E  
> **门禁**：Plan 定稿与业务编码前须链接本文（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 用户已在术语表维护 **正确专名/术语形**（canonical），并在编辑保存中积累 **错→对**（如「安波那那→安那般那」）。转写后仍常见：同音误写、同一专名前后写法不一、L2 热词无法纠正的「听对形错」。需要 **可解释、可预览、可拒绝** 的批量改正，而不是静默改稿或重跑 ASR。 |
| **本仓现状** | **L2**：`glossary_terms` → `build_glossary_hotwords` → 本机/在线 STT（[`acc-stt-unify-research.md`](./acc-stt-unify-research.md)）。**P2 记忆**：`correction_memory` + `infer_single_replacement` / `update_correction_memory_from_save`（[`correction.rs`](../../../apps/desktop/src-tauri/src/project/correction.rs)）；转写后 `collect_correction_rule_hints` 仅 **warning**（最多 5 条，前缀 `correction_rule_hint:`）。**L4 已落地**：R3t-C 标点、R3t-D `postprocess_refine_segments`（merge/split/update_text + 预览）。**缺口**：LLM 未消费结构化词表；无 `evidence` 校验与「词表校对」入口。 |
| **成功标准** | 手测：术语表含「安那般那」、语段为「安波那那」→ 预览建议改正且依据标 **术语表/规则**；取消不改库；确认写回后 memory 可学习。自动：`lexicon_pack` 组装 + 无依据 op 丢弃的单测。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 可验证链接 |
|---|------|-----------------|----------|------------|
| **A** | **STT 层词汇偏置** | FunASR `hotword=`、OpenAI transcription `prompt`、AssemblyAI `keyterms_prompt`、Azure phrase list、Amazon Transcribe custom vocabulary | 在 **识别阶段** 提高专有词命中率；多为短语表或 prompt，**不保证** 输出字形与 canonical 一致 | [AssemblyAI Keyterms](https://www.assemblyai.com/docs/pre-recorded-audio/keyterms-prompting)、[AWS Custom vocabulary](https://docs.aws.amazon.com/transcribe/latest/dg/custom-vocabulary.html)、本仓 [`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md) |
| **B** | **STT 后拼写/替换表（厂商内置）** | AssemblyAI **Custom Spelling**（`from[]` → `to`）、Amazon Transcribe table **DisplayAs** | 在 **转写结果文本** 上做确定性替换；规则与 ASR 解耦，仍 **无用户预览**、无项目内 memory 闭环 | [AssemblyAI Custom Spelling](https://www.assemblyai.com/docs/pre-recorded-audio/correct-spelling-of-terms) |
| **C** | **桌面编辑器：词表 + 纠错学习** | **Descript** Transcription Glossary（预置 + 同一错词改 3 次自动入库）、**NVivo Transcription** Dictionary（Sounds like → Desired transcription，编辑页 find/replace 可写入词典） | 产品层 **双轨**：转写前 glossary 偏置 + 转写后 **Correct / Correct All** 与词典学习；偏 **人工确认**，非单次 LLM JSON | [Descript Glossary](https://help.descript.com/hc/en-us/articles/10249407290637-Transcription-glossary)、[NVivo Dictionary](https://help.mynvivo.com/nvtranscription/Content/dictionary.htm) |
| **D** | **LLM 转写后编辑（学术/工业）** | **CEGER**（Context-Enhanced Granular Edit Representation）：LLM 输出 `[DELETE]/[INSERT]/[REPLACE]` 等紧凑编辑，**确定性展开** 还原全文；**NLE** 等将 ASR 视为 **条件文稿编辑** 而非全文重写 | 降低 token、减少「整段幻觉改写」；强调 **编辑算子** 而非自由润色 | [CEGER arXiv:2509.14263](https://arxiv.org/abs/2509.14263)、[NLE arXiv:2603.08397](https://arxiv.org/abs/2603.08397) |
| **E** | **本地化 / CAT 术语与记忆** | Trados/MemoQ **术语库** + **翻译记忆（TM）** 片段匹配；现代 CAT 对 MT 输出做 **术语违反检测** | 强 **有据**（命中 TM/术语条目）；依赖对齐与语言对，**过重** 于口语转写单语段校对 | 路线图 §8 **CAT-TRAN 远期不做**；[`lexicon-mining-backlog.md`](./lexicon-mining-backlog.md) LEX-MINE 仅候选 |
| **F** | **RAG / 领域语料增强校对** | 通用 RAG + LLM「按文档改稿」 | 引用外部段落作依据；隐私、延迟、幻觉引用难控 | 路线图 **2026-05-27 明确不做**（R3t-E 仅 LexiconPack） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| **A STT 偏置** | **高（已落地）** | `SttVocabularyPlan`、本机 `hotwords`、在线 adapter | **不能** 替代 L4：同音形错、前后不一致需 **改稿**；禁止把 hotwords 空格串塞进 LLM prompt（路线图硬规则） | 无额外 LLM 成本；偏置效果有限（Q-ACC-5） |
| **B Custom Spelling** | **中** | `wrong→right` 与 `correction_memory` **同形**；可启发 **high 权重规则** 的确定性预检（v1 可选、非必须） | 厂商 API 在 **云端转写** 侧；Rushi **本机 FunASR + 用户 LLM 密钥** 需自建；无 preview/consent | 若 v1 全走 LLM 则不必先做 Rust 字面替换引擎 |
| **C Descript/NVivo** | **中（产品模式）** | 用户心智：**词表 + 纠错记忆 + Correct 前预览**；Descript「改 3 次入库」≈ `hit_count≥2` | 他们多 **英文**、Drive 级词表；我们 **全局 glossary** + SQLite memory | UI 可复用 R3t-D 预览/dialog 模式 |
| **D CEGER / 紧凑编辑** | **中（算子思想）** | R3t-D 已用 **ops JSON**（merge/split/update_text）；E 可仅 **`update_text` + evidence**，服务端校验 | 完整 CEGER 命令集 **过重**；中文同音需 LLM 推断，不能只靠 `[REPLACE]` 字面表 | 窗口内段数受限（与 D 相同）可控 token |
| **E CAT/TM** | **低** | 「每条修改必有条目依据」的验收哲学 | 需 segment 对齐、双语、许可；与 **单语转写编辑器** 产品形态不符 | 运维与 schema 成本 → **不做 v1** |
| **F RAG** | **低** | — | 上传/检索语料、引用片段 evidence → 与 **loopback、隐私文案** 冲突 | 延迟与包体积不可控 → **不做** |

**本仓已有可复用模块**（须扩展而非重造）：

| 模块 | 路径 | R3t-E 用法 |
|------|------|------------|
| 纠错记忆读写 | `apps/desktop/src-tauri/src/project/correction.rs` | Pack 中 `correction_rules` 与 `collect_correction_rule_hints` **同源 SQL**（`accepted_as_rule=1 OR hit_count>=2`，上限 40） |
| 术语表 | `glossary_terms` + GLY-1 UI | `glossary_canonical[]`；**不**自动拆 wrong→right |
| L2 热词 | `build_glossary_hotwords` / ACC-STT-UNIFY | 保持并行；E **不传** hotwords 串 |
| LLM 远程边界 | `postprocess_cmd.rs`、`postprocessRuntimeContract.ts` | 新命令走同一 HTTPS、密钥、consent 体系 |
| 段界预览 | `useSegmentRefineController.ts`、`SegmentRefinePreviewDialog.tsx` | 复制 **consent → loading → preview → confirm + pushUndo**；展示 **evidence 列** |
| 段 ops 校验 | `postprocess_segment_ops.rs` | E 可共用 `update_text` 形状；**额外**校验 `evidence`  ⊆ LexiconPack |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **L4 LexiconPack**（`glossary_canonical` + `correction_rules`）→ 独立命令 **`postprocess_lexicon_proofread`**（或与 D 分 mode，实施时二选一，**默认独立** 以利 prompt/验收分离）→ LLM 仅输出 **`update_text` ops + evidence** → Rust **丢弃无 Pack 依据的 op** → UI **「AI 校对（词表）」** 显式触发 + 预览 + 确认写回。 |
| **与路线 A/B 的关系** | **A 继续做 L2**（已 ACC-STT-UNIFY）；**B 不接入厂商 Custom Spelling**（在线通道已各有 adapter，且无法覆盖本机 FunASR 结果）。L4 负责 **字形与一致性**。 |
| **与路线 C 的关系** | 采纳 **「词表 + 记忆 + 用户确认」** 闭环；**不**做 Descript 式「静默整项目 Correct All」v1。 |
| **与路线 D 的关系** | 采纳 **JSON ops + 最小改动**；**不**引入 CEGER 全命令集；段界仍 **仅 R3t-D**。 |
| **不做什么（v1）** | 领域 **RAG**；**CAT/TM** 模块；**本地 LLM** 校对；**无依据** 风格润色；**自动整文件** 静默跑 E；**项目级独立词表**（仍全局 `glossary_terms`）；把 **hotwords 空格串** 塞进 LLM prompt；**重复转写** 指望改正；**LEX-MINE** 自动挖词（另薄片）；v1 **不**把 glossary term 自动展开为 wrong→right 规则（仅 canonical 锚点）。 |
| **与 ADR / architecture** | 对齐 [`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)、[`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md)、[`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md)；L2/L4 双通道不变。 |
| **风险与 spike 项** | ① LLM 幻觉 `evidence` → **服务端 Pack 子串校验**（必做）。② 中文同音无字面 rule → 依赖 canonical + 邻段上下文，手测须覆盖「仅有 glossary 无 memory」。③ Pack 截断 → UI 明示「仅发送前 N 条」。④ 与 R3t-C 标点 **默认分开触发**（plan §6）；若合并请求留 **v2**。⑤ 可选 spike：high 权重 `wrong→right` **确定性预替换** 再送 LLM（减 token），**非 v1 阻塞**。 |

### 4.1 推荐 v1 流水线（相对业内 D 的落点）

```text
用户点「AI 校对（词表）」
  → Rust assemble LexiconPack (glossary≤200, rules≤40)
  → 窗口 stable segments（对齐 R3t-D：选中段 ± 邻段，上限条数）
  → HTTPS LLM：仅 update_text + evidence JSON
  → Rust filter ungrounded ops
  → UI preview（原文/改文 + 依据类型：rule | glossary | inconsistent_term）
  → 用户确认 → pushUndo 写回 → 既有 save 路径学习 correction_memory
  → 可选「采纳为纠错规则」→ accepted_as_rule=1（与 P2 转写 hints 闭环）
```

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| **Rust** | `project/lexicon_pack.rs`（新） | 从 DB 组装 LexiconPack、截断 meta |
| **Rust** | `postprocess_cmd.rs` + `lib.rs` register | `postprocess_lexicon_proofread`、prompt、evidence 校验 |
| **Rust** | 可复用 `postprocess_segment_ops.rs` 中 `update_text` 解析 | 扩展 evidence 字段 |
| **TS** | `postprocessLexiconContract.ts`（新）、`useLexiconProofreadController.ts`（新） | 编排、预览文案 |
| **UI** | `LexiconProofreadPreviewDialog.tsx`、工具栏入口 | 依据列；隐私文案追加「词表条目将发送」 |
| **测试** | Rust unit（pack + filter ops）；Vitest controller/contract mock HTTP | 对齐 acceptance §R3t-E 自动项 |

**禁止**：第二套 `correction_memory` 表；第二套 glossary 真源；在 transcribe 薄片内预建 CAT schema。

---

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 已链接本文
- [x] 编码已落地（2026-05-31）；手测签收见 acceptance §R3t-E

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-05-31 | 初版：对照 STT 词汇、Custom Spelling、Descript/NVivo、CEGER/NLE、CAT/RAG；采纳 LexiconPack + grounded LLM ops |

# R3t-F 调研：转写后一键后处理套件（修订版 · 可行性 + 竞品细节）

> **状态**：已采纳（2026-05-31 修订 v2）· **实施真源** → [Plan v3](./r3t-f-post-transcribe-suite-plan.md)  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10  
> **关联架构**：[`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md)、[`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)  
> **Plan / Acceptance**：[`r3t-f-post-transcribe-suite-plan.md`](./r3t-f-post-transcribe-suite-plan.md)、[`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 转写后希望 **少点击** 完成标点、段界、词表/记忆纠错与（可选）语义润色；**低把握处不改**（可调阈值）。编辑主路径应对标 **Correct All / Cmd+F / 词表喂下次转写**。 |
| **本仓现状** | L2 词表 + L3 分段 ASR + L4（C/D/E 分入口、D/E 仅 **±1 邻段窗**）已编码。缺：全文规则批处理、搜索/Correct All、一键编排、**全文级**段界/标点批处理、可信的置信门控。 |
| **成功标准（修订）** | **主路径**：F1+F2 达到 Sonix/Descript **80% 日常改稿**；**增强路径**：F0 编排 **默认不含全文段界**；F4/F5 用 **ASR 置信筛段 + LLM 分双轨**，非单一「模型自评滑条」。 |

---

## 2. 竞品细节对标（转写后 + 编辑）

### 2.1 功能矩阵

| 能力 | [Descript](https://help.descript.com/hc/en-us/articles/10119613609229-Correct-your-transcript) | [Otter](https://help.otter.ai/hc/en-us/articles/360048571373-Manage-vocabulary) | [Sonix](https://help.sonix.ai/en/articles/1756243-how-do-i-use-sonix-s-find-replace-feature) | [AssemblyAI](https://www.assemblyai.com/docs/pre-recorded-audio/correct-spelling-of-terms) | **Rushi 目标（R3t-F）** |
|------|----------|-------|-------|------------|---------------------|
| 转写前词表 | Glossary（Drive 级，≤30 词） | Custom Vocabulary（套餐限额） | Custom Dictionary | `keyterms_prompt` | ✅ GLY-1 + hotwords |
| 转写后 **一键** 标点+分段+AI 润色 | ❌ 无；用户 **导出到 Notion/ChatGPT**（[功能票](https://descript.canny.io/feature-requests/p/ai-script-corrections)） | ❌ | ❌ | API 内字段，非编辑器一键 | **F0 编排**（诚实标注「多步+预览」，非魔法一键） |
| 标点 / 分段 | 快捷键改标点（Z+X）；**无**自动全文标点 | 手改 | 手改 | N/A | **R3t-C/D**（LLM，需批处理设计） |
| 选中改正 | Correct / **Correct All** | 编辑模式手改 | 高亮 → 加入词典 | N/A | **F2** |
| 全文查找替换 | 搜索面板 + Correct 流 | Ctrl+F 浏览器搜索 | **Find & Replace**（Ctrl+Shift+H，Replace All） | custom_spelling 批替换（API） | **F2 Cmd+F** |
| 改 N 次进词表 | 同错 **3 次** 自动进 Glossary | 手改+词表 | 改正 → 点「书」图标进词典 | N/A | **F6**（hit_count≥3） |
| 低置信提示 | 不明显费产品化 | 不明显 | 不明显 | N/A | **已有** `low_confidence` UI + **F4 ASR 筛段** |
| LLM 语义润色 | 外部工作流为主 | 无 | 无 | N/A | **F5 可选**（Rushi 差异化，高风险） |

### 2.2 竞品未做、用户却想要的事（机会与陷阱）

| 诉求 | 竞品现状 | 对 Rushi 启示 |
|------|----------|---------------|
| 转写后 **一次** 标点+分段+grammar | Descript 官方 **未做**；社区长期索要 | 可做 **F0**，但必须 **分步预览 + 进度条**；勿宣传成 Descript 已有 |
| 中文 **同音** 改正 | 英文 Correct All 成熟；中文无词界 | **F1 仅适合 memory 字面规则**；同音靠 **F5 LLM** 或 **重转写+热词** |
| 「模型置信度滑条」 | 消费级产品 **几乎不暴露** LLM 自评分 | 应对标 **Gladia/Deepgram 式 ASR 词级置信**（[QA 文](https://www.gladia.io/blog/confidence-scores-and-quality-flags-in-note-taker-transcripts)），LLM 分作补充（[INTERSPEECH 2024](https://www.isca-archive.org/interspeech_2024/naderi24_interspeech.pdf)、[daintree PR](https://github.com/daintreehq/daintree/pull/2834)） |

---

## 3. 本仓可行性评估（按子包）

| 包 | 技术可行性 | 产品可行性 | 主要阻塞 | 修订结论 |
|----|------------|------------|----------|----------|
| **F1** 全文规则 | **高** | **高** | 中文无词界 → **禁止** v1 盲目 canonical 全文替换 | **v1 仅 `correction_memory` 规则**；预览 diff 必做 |
| **F2** 手动查找替换 / Correct | **高** | **高** | 与 `segmentDraftStore` 冲突 → **搜索/替换前 flush**；Replace All 须预览 | **P1 首刀**；对齐 Sonix Find & Replace + Descript Correct All；**规划已纳入，未编码**（见 Plan §4.1） |
| **F3** LEX-MINE | **高** | **中** | 推荐质量依赖 memory 量 | 纯 SQL 聚合 + 勾选入库，**不**接 LLM |
| **F6** 三次进词表 | **高** | **高** | 与 Descript 次数阈值可对齐为 3 | 小薄片，可跟 F2 同轮 |
| **F0** 一键编排 | **中** | **中** | 见 §4 | **拆 F0-lite / F0-full** |
| **F4** 置信门控 | **中** | **中** | FunASR **句级 confidence 常缺失**（`segmentation.py` 无则 `low_confidence`） | **双轨门控**（§5），非单一 LLM 分 |
| **F5** 语义审校 | **中** | **低~中** | 幻觉、责任边界；与 evidence-only E 冲突 | **F5.1 可选**；默认关；强预览 |
| **R3t-C 全文标点** | **中** | **高** | 108min ≈ 数百段 → **N 次 HTTP**、成本 | F0 内 **批处理+进度**，非单次请求 |
| **R3t-D 全文段界** | **低~中** | **高** | 现实现 **仅 3 段窗**；全文 merge/split 无契约 | **移出 F0 v1** → **R3t-D2 spike** |

---

## 4. F0 一键愿景：可行性拆解（修订）

### 4.1 用户想象的「一键」

```text
转写完成 → [智能后处理] →（标点 + 重新分段 + 词表纠错 + 语义）→ 完稿
```

### 4.2 工程现实（本仓 2026-05）

| 步骤 | 现成？ | 全文 108min 级 | 修订纳入 F0 v1 |
|------|--------|----------------|----------------|
| 规则纠错 F1 | 待建 | 本地毫秒级 | ✅ **默认勾选** |
| 标点 C | ✅ 单段 API | 需循环段数 / 合并 prompt | ✅ **F0-lite：批处理 C**（可限流） |
| 段界 D | ✅ 三段窗 | **不能**当「全文重新分段」 | ❌ v1 改为「**当前窗段界**」或 **另立项 D2** |
| 词表 E / 语义 F5 | ✅ 三窗 LLM | 成本 ∝ 窗数 | ⚠️ **仅低置信段** 或 **用户显式勾选** |

### 4.3 修订产品定义

| 名称 | 用户承诺 | 包含 |
|------|----------|------|
| **F0-lite**（v1） | 「转写后处理（规则+标点）」 | F1 → 批处理 C（预览汇总）→ 可选「仅处理低置信段」的 E |
| **F0-full**（v2） | 「含段界与语义」 | + D2 全文/滑窗段界 + F5 语义（F4 门控） |

**不对标**：Descript 也未内置的「单次点击全文 AI 润色」；对外文案用 **「guided pipeline」** 而非 **「one-click magic」**。

---

## 5. 置信度模型（修订 · 可行性优先）

消费级产品 **很少** 让用户调「LLM 自信度」。可行且可验证路线：

### 5.1 轨 1 — ASR 置信（优先）

| 项 | 本仓 | 做法 |
|----|------|------|
| 数据源 | `segments.confidence`、`low_confidence`（FunASR `sentence_info` 有则填） | 段级 `min_confidence`；连续低置信 **优先队列**（Gladia 建议 3 词以上成段） |
| 用途 | ① UI 已高亮 ② **仅将这些段送入 F5/E** ③ 全文高置信时 **跳过 LLM**（对齐 [daintree](https://github.com/daintreehq/daintree/pull/2834) skip-if-clean） |
| 阈值 | 设置：`asr_review_max_confidence`（默认 0.85）— **低于此才送 LLM** | 与「用户阈值」语义一致，但 **有数据依据** |

### 5.2 轨 2 — LLM op 置信（补充）

| 项 | 做法 |
|----|------|
| 契约 | 每条 op `confidence`；`fluency`/`logic` **cap ≤0.9** |
| 用户阈值 | `llm_apply_min_confidence` 仅过滤 **轨 2** |
| 无 ASR 分 | 段 **默认送审**（保守） |

### 5.3 轨 3 — 规则 F1

确定性替换 **confidence=1**，不受用户 LLM 阈值影响（预览内单独区）。

---

## 6. 成熟路线复用评估（保留 §2 编号）

| 路线 | 复用度 | R3t-F 修订 |
|------|--------|------------|
| A 转写前词表 | 高 | 加强「转写前检查词表」空状态提示，不新造存储 |
| B API custom_spelling | 中 | 本机 → **F1 规则**；在线 → 已有 adapter |
| C Descript/Sonix 编辑 | **高** | **F2 为主路径**，优先于 F0 |
| D/E LLM 流水线 | 中 | **F0-lite** 编排；勿合并 prompt v1 |
| F ASR 置信 | **高（修订后）** | **F4 以 ASR 为主**；LLM 为辅 |

---

## 7. 决策摘要（修订）

| 问题 | 结论 |
|------|------|
| **愿景是否可行** | **整体可行**，但必须 **分三期**；**不可行**的是「v1 单次点击完成全文段界+语义且零预览」 |
| **与竞品关系** | **F2+F1** 对标 Sonix/Descript **可达成**；**F0-full** 超越 Descript **需克制宣传** |
| **中文特化** | 同音 ≠ 查找替换；**F1 不做谐音猜测**；语义靠 F5 或 L2 重转写 |
| **不做什么（F v1）** | 全文 LLM 段界；无预览；canonical 盲目全文替换；RAG；LEX-MINE 进 prompt；静默改稿 |
| **实施顺序（修订）** | **F2（手动 Cmd+F + Replace All 预览）→ F1 → F6 → F0-lite → F4(ASR) → F5 → F3 → D2**；编码 **未启动** |

---

## 8. 落位预告（无变化，F0 控制器仍新建）

见 [`r3t-f-post-transcribe-suite-plan.md`](./r3t-f-post-transcribe-suite-plan.md)。

---

## 9. 风险登记

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| FunASR 无词级 confidence → F4 退化 | 高 | 无分时默认「全段可送 LLM」；UI 说明 |
| 批处理 C 成本/超时 | 中 | 限段数、可取消、显示预估 |
| F5 改坏原文 | 高 | 默认关；fluency 须 diff 高亮；undo |
| 用户以为一键=Descript 已有 | 中 | 文案写清「多步流水线」 |

---

## 10. 产品拍板（2026-05-31 用户确认）

| 项 | 决策 |
|----|------|
| **F0-lite 默认勾选** | **仅**「规则全文（F1）」+「补全标点（批处理 C）」；**默认不勾** AI 词表/语义（E/F5），省 token、少幻觉 |
| **F5 语义边界** | **仅**修正明显不通顺、不合逻辑处；**禁止**改风格、扩写、删减整段、改说话人；写进 prompt + acceptance 手测 |

## 11. 签收

- [x] 调研 brief v2（可行性 + 竞品细节修订）
- [x] Plan / Acceptance 已同步修订
- [x] 上表两项产品拍板
- [ ] F0-lite / P1 编码启动

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-05-31 | 初版意向收束 |
| 2026-05-31 | **v2**：竞品矩阵、逐项可行性、F0-lite/full 拆分、置信双轨、段界移出 v1 |
| 2026-05-31 | **拍板**：F0-lite 默认仅规则+标点；F5 语义边界收紧 |
| 2026-05-31 | **规划**：F2 手动查找替换（Cmd+F）写入 Plan §4.1；**未编码** |
| 2026-05-31 | **调研**：[`r3t-f-edit-memory-for-llm-research.md`](./r3t-f-edit-memory-for-llm-research.md) 手改记忆→LLM 业内实现 |
| 2026-05-31 | **Plan v3** 合并全部拍板与小团队交换为实施真源 |

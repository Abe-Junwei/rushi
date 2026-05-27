# Backlog: 词表挖掘与训练数据（LEX-MINE / ASR-FT）

> **状态**：候选 backlog（**未排期**）；非 execution 真源  
> **排期真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §8 / §8.1  
> **关联**：[`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)（R3t-E）、[`p2-acceptance.md`](../p2-acceptance.md)、[`oumi-remediation-report.md`](./oumi-remediation-report.md)  
> **跨仓历史**：Jieyu [`如是我闻-本地版改进计划书-2026-05-11.md`](../../../../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md) §5、§8 P5

---

## 1. 为何单独成文

早期规划里与「词表 / 热词 / 训练」相关的设想**分散在三处**，且常被混读为同一条线：

| 常见误读 | 实际在文档里的含义 |
|----------|-------------------|
| 「用已有文本 **训练 LLM**，自动识别热词」 | 计划书 **§5.2–5.3** 是 **ASR LoRA + 音频对齐 manifest**，不是 LLM 挖词 |
| 「LLM 从语料建词表」 | 计划书 **§4.7 / P5** 是 **云端 LLM 保守校对（推理）**；无「训练 LLM 抽热词」spec |
| 「纠错数据自动变训练集」 | Oumi 调研 **P1-2 synthetic dataset** → **2026-05-25 评审排除**（schema 不足） |
| 「从校对历史推荐术语」 | 计划书 **§5.1.2 术语推荐**（**规则/统计**）→ Rushi **未立项 UI** |

本文件把 **未进路线图** 的候选能力集中登记，避免与 **R3t-E（已有词表有据校对）** 再次混淆。

---

## 2. 历史真源对照

### 2.1 Jieyu 计划书 §5「自我学习闭环」

| 阶段 | 内容 | Rushi 现状 |
|------|------|------------|
| **5.1 无需训练** | 纠错记忆；**从高频纠错推荐术语**；错词规则；讲师词库 | ✅ memory + hints；❌ **术语推荐 UI** |
| **5.2 训练数据准备** | 切纠错音频片段；对齐；**训练 manifest**；质量标记 | ❌ 未做 |
| **5.3 可选 LoRA** | 手动触发；10h+ 语料；测试集；CER/术语回归 | ❌ 未做；**§8 P5 候选** |

计划书 **§13** 原则：**先非微调增强，后模型训练**；**§12** 冻结：**微调全部 P5，不进 MVP**。

### 2.2 Oumi 整改报告（2026-05-25）

| 项 | 结论 |
|----|------|
| 纠错记忆 → **synthetic dataset** | ❌ **排除** — 缺 `project/domain/context/privacy` |
| 数据合成管道（Part II 愿景） | 仅参考；**Part I 不执行** |
| R4（QLT-1） | ✅ `correction_memory` **导出 JSONL + 脱敏**；❌ 不生成训练集 |

路线图 **§8 明确不做**：`correction_memory → 训练集`。

### 2.3 Rushi 已落地（与 backlog 的关系）

| 能力 | 位置 | 作用 |
|------|------|------|
| `glossary_terms` + GLY-1 | 手动维护 | L2 `hotwords` |
| `correction_memory` + save 学习 | P2 | L2 hints；**R3t-E** LexiconPack 来源 |
| R3t-E（规划） | `lexicon-guided-llm-refine.md` | **消费**已有词表校对；**不**自动建表 |

---

## 3. 与 R3t-E 的边界（必守）

```text
LEX-MINE（本 backlog）     →  产出「候选词条 / 候选规则」→ 用户勾选 → 写入 glossary / memory
R3t-E（R3t 已规划）        →  输入已是 glossary + memory  → LLM 改稿 + evidence → 预览确认
```

| 维度 | LEX-MINE | R3t-E |
|------|----------|-------|
| 输入 | 全库语段、edit_log、correction_memory 聚合 | 选定语段 + **已定** LexiconPack |
| 输出 | 候选列表（无静默写库） | `update_text` ops + evidence |
| LLM | 可选（只读扫描 / 排序说明） | 必须（云端校对） |
| 训练 | **不做** | **不做** |

**禁止**：把「挖词」和「校对」合成一次 LLM 调用（prompt 失控、依据不可审计）。

---

## 4. 候选 Epic A — LEX-MINE（词表候选推荐）

**目标**：补齐计划书 **§5.1.2**，让用户从**已有校对行为**中发现「该进术语表 / 该固化规则」的候选，**不**依赖模型训练。

### 4.1 子阶段（草案）

| 子阶段 | 机制 | 依赖 |
|--------|------|------|
| **LEX-MINE-1** | **规则层**：按 `correction_memory` 聚合 `wrong→right`（hit_count、accepted_as_rule）；去重；cap 列表 | P2 ✅ |
| **LEX-MINE-2** | **UI**：术语管理页或校对后侧边「推荐加入术语表」；批量采纳 / 忽略 | GLY-1 ✅ |
| **LEX-MINE-3** | **可选 LLM 辅助**（非训练）：对候选对或语段窗口生成「为何像专名/术语」**说明**；Rust 仍只接受可对照 memory 的条目 | R2 隐私文案 + keychain |
| **LEX-MINE-4** | **可选语料扫描**（非训练）：项目内 stable 语段 TF-IDF / 专名启发式 **或** LLM 只读提取 **候选** → 一律进预览队列 | R3t-B stable 段 |

### 4.2 v1 明确不做

- 静默写入 `glossary_terms` 或 `accepted_as_rule`
- 用项目全文 **fine-tune** 任意模型
- 替代 R3t-E 校对
- MCP 写术语（路线图 §8 仍排除写 MCP）

### 4.3 验收草案（立项时再拆 acceptance）

- [ ] 同一 wrong→right 累计 ≥2 次（或已 accepted）出现在推荐列表
- [ ] 用户忽略后不再骚扰（或降权）
- [ ] 采纳后下次转写 hotwords / correction hints 可观测
- [ ] 若启用 LLM-3：须明示「语段片段将发云端」；取消则不调用

---

## 5. 候选 Epic B — ASR-FT（训练数据 / 领域微调）

**目标**：对齐计划书 **§5.2–5.3** 与 Oumi **数据合成**愿景，但**仅在 schema 与 ROI 就绪后**单独立项。

### 5.1 前置（Go 门槛）

| # | 条件 |
|---|------|
| G1 | P0–P4 / R9 证明「校对工作台」ROI（计划书 §13） |
| G2 | `correction_memory`（或导出 JSONL）补全 **project_id / file_id / span / privacy_class** |
| G3 | 独立 **held-out** 评测集（计划书 §9） |
| G4 | 用户 **手动** 触发；可回滚模型（计划书 §5.3） |
| G5 | 与 **R3h** 侧车分发策略一致（权重不进 Git） |

### 5.2 子阶段（草案，**远未排期**）

| 子阶段 | 内容 |
|--------|------|
| **ASR-FT-1** | 纠错片段切分 + 对齐 manifest（WhisperX / FunASR timestamp） |
| **ASR-FT-2** | 脱敏导出 + synthetic 质检字段 |
| **ASR-FT-3** | 可选 LoRA / 热词列表 **从 manifest 统计**（仍非 LLM 训练） |

路线图 **§8** 在 G2 完成前维持：**correction_memory → 训练集 = 不做**。

---

## 6. 建议排期位置（若产品拍板）

```text
… → R3t-E 签收 → LEX-MINE-1/2（可与 R4 导出 JSONL 并行设计）
… → R9 REL-1 + 评测集稳定 → 再评 ASR-FT Go/No-Go
```

**不要**插在 R3g / R3h 发行阻塞之前（单人薄片纪律）。

---

## 7. Oumi vs ASR-FT vs R3t-E（为何不「动模型」）

> 用户问：能否借鉴 [Oumi](https://github.com/oumi-ai/oumi) 训练领域模型以提高精度？  
> **结论**：Oumi 主训 **LLM/VLM**（SFT/LoRA/`oumi train`）；Rushi 瓶颈在 **FunASR 听写** + **文本校对**。**当前不照搬 Oumi 动权重**；「越用越准」走 **记忆 + 热词 + R3t-E**，远期 ASR 微调走 **ASR-FT**（非 `oumi train`）。

### 7.1 三条路径各改什么

| 路径 | 改的是 | 主要提升 | Rushi 状态 |
|------|--------|----------|------------|
| **Oumi 式训练** | LLM（及合成数据）权重 | 生成/校对类任务 | Part I **排除** Synth；不进侧车 |
| **ASR-FT** | FunASR/SenseVoice **声学权重** | 听写 CER、专名 | §5 候选；Go 门槛未满足 |
| **R3t-E** | **不改权重**；LexiconPack + 云端 LLM | 同音、术语不一、有据改稿 | 规划；RAG **不做** |

```text
听写精度  ← ASR 权重（ASR-FT 远期）+ glossary hotwords（现在）
改稿精度  ← correction_memory + R3t-E（规划）  ≠  Oumi 训 LLM 进桌面
```

### 7.2 为何不现在用 Oumi「动模型」

| 原因 | 说明 |
|------|------|
| **工具错位** | Oumi 文档与 Recipe 面向 **Llama/Qwen 等 LLM**；不是 FunASR 训练平台 |
| **产品错位** | 消费级桌面（~5GB、纯小白）vs 训练/集群 MLOps |
| **工程错位** | 推理侧车已 ~2GB；**训练栈不进 PyInstaller**（路线图 §8、postprocess 边界） |
| **数据未就绪** | `correction_memory` 无 audio span / privacy / domain → **不做 synthetic dataset**（oumi 报告 Part I） |
| **评测未就绪** | 无 held-out 禅修集；计划书 §13：先证明校对工作台 ROI 再 LoRA |
| **更便宜手段未用尽** | 热词 + memory hints + R3t-E 边际通常优于首轮微调成本/风险 |

### 7.3 Oumi 仍值得借鉴什么（不动权重）

见 [`oumi-remediation-report.md`](./oumi-remediation-report.md) Part I：MCP 只读、规则 eval（R4）、prepare/manifest（R3h）、远程 postprocess。**不**采纳：`services/llm/` 统一引擎、桌面内 `oumi train`、memory→训练集自动管道。

### 7.4 若未来要做「领域 ASR 模型」

1. 单独立项 **ASR-FT**（§5 Go 门槛），用 **FunASR/ModelScope 官方微调** + 音频-文本 manifest。  
2. 新权重经 **R3h manifest** 分发，**可回滚**，回归不过不替换默认 SKU。  
3. **不要**在 App 内嵌 Oumi CLI 或把 correction_memory 直接接 Oumi Synth。  

若只做 **校对 LLM 专模**：与 R3t-E（云端 API）重复；本地 7B 需 GPU + 发行，**非当前路线**。

---

## 8. 文档索引

| 文档 | 关系 |
|------|------|
| [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §8.1 | 候选 Epic 登记表 |
| [`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md) | R3t-E；**消费**词表 |
| [`translation-cat-backlog.md`](./translation-cat-backlog.md) | **CAT-TRAN** 候选；与 glossary 分轨 |
| [`recording-transcribe-llm-refine-plan.md`](./recording-transcribe-llm-refine-plan.md) | R3t 总 plan |
| [`oumi-remediation-report.md`](./oumi-remediation-report.md) | synthetic 排除；**§五-b** 为何不照搬 Oumi 动模型 |
| [`p2-acceptance.md`](../p2-acceptance.md) | P2 已交付 / 增强项备注 |
| Jieyu 计划书 §5、§8 P5 | 历史来源 |

---

## 9. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-27 | 初版：登记 LEX-MINE / ASR-FT；对齐计划书 §5、Oumi 排除、R3t-E 边界 |
| 2026-05-27 | §7：Oumi vs ASR-FT vs R3t-E；为何不照搬 Oumi 动模型 |

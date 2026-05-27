# Backlog: 翻译与词典（CAT-TRAN）

> **状态**：**远期规划**（**当前不做**）；spec 保留作立项真源  
> **产品侧重（2026-05-27）**：**转写主线优先** — R3g/R3e/R3t（声学分段、长音频、稳定落库）；CAT-TRAN **不进入**近期排期  
> **完整 spec**：[`translation-dictionary-module.md`](./translation-dictionary-module.md)（T1–T6 切片）  
> **排期真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §8 / §8.1 / §10  
> **关联**：[`p2-acceptance.md`](../p2-acceptance.md)（glossary）、[`lexicon-mining-backlog.md`](./lexicon-mining-backlog.md)、[`auto-punctuate-intent.md`](./auto-punctuate-intent.md)、[`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md)

---

## 0. 产品决策（2026-05-27）

| 项 | 决定 |
|----|------|
| **现在** | **不做** CAT-TRAN 任何切片（含 T1 schema）；不预建 `dictionary_entries` / `target_text` |
| **远期** | 保留 [`translation-dictionary-module.md`](./translation-dictionary-module.md) 与本文；中译英需求明确且 **转写 Epic 签收后** 再 Go |
| **当前重心** | **转写**：本机 ASR 发行（R3h）、模型/catalog（R3g）、长音频（R3e）、录音分段落库（R3t-A/B） |

**禁止漂移**：不在转写薄片内「顺带接翻译 API」或「为 CAT 先改 segment 模型」。

---

## 1. 讨论结论（为何单独登记）

仓库里**曾完整讨论并写成 spec** 的「翻译模块 + 词典编辑（CAT）」与当前主线 **转写 / 中文校对 / LLM 后处理** 是**不同 Epic**：

| 模块 | 用户任务 | 数据真源 | 路线图 |
|------|----------|----------|--------|
| **术语库 glossary** | ASR 热词、中文专名偏置 | `glossary_terms`（字符串） | ✅ GLY-1 + P2 |
| **纠错记忆** | 错词→正词、转写 hints | `correction_memory` | ✅ P2；R3t-E 规划消费 |
| **词典 dictionary** | 中→英词条、词性、领域、例句 | `dictionary_entries`（规划） | ❌ 未建表 |
| **翻译 CAT** | 语段 `target_text`、机翻/人工、双语 DOCX | segments 叠加字段 + 翻译 API | ❌ 未实施 |

路线图 **§8 明确不做（至 C3 前）**：**翻译词典 / CAT 全模块** — 与 glossary **不同表、不同目标**。

本 backlog **不重复** spec 里的 API/SQL，只登记：**讨论过什么、为何没排期、与 glossary/R3t 的边界、何时可立项**。

---

## 2. Spec 已确认的决策（摘要）

来源：[`translation-dictionary-module.md`](./translation-dictionary-module.md) 文首 + §2。

| 决策 | 内容 |
|------|------|
| 输入 | 现有转写语段，或独立导入 TXT/DOCX/SRT |
| 翻译层 | **原 file 叠加** — `target_text` / `target_status`，不另建双语 file |
| 修订 | **方案 B**：语段内子范围批注（comment / suggestion / term_check），**非**字符级 Track Changes |
| 引擎 | 多供应商（DeepL / Google / OpenAI / 百度 / 有道等）；Key 存 SQLite；24h 缓存 |
| 词典 ↔ 术语库 | **分表**；`glossary_to_dictionary` / `dictionary_sync_to_glossary`；`is_glossary_linked` |
| 导出 | 首期 DOCX **对照表 + 干净稿**；批注稿二期 |
| 分片 | **T1–T6**（数据层 → 引擎 → 词典 CRUD → 批注 UI → 联动 → DOCX） |

---

## 3. 与 glossary / R3t / R2 的边界（讨论中易混）

```text
glossary          → L2 ASR hotwords（中文听写）
correction_memory → L2 hints + R3t-E LexiconPack（中文改稿依据）
dictionary        → 中译英术语表 + CAT 一致性（与 ASR 无直接关系）
translation       → target_text 工作流 + 外部 MT API
R2 / R3t-E        → 仅中文 postprocess；**不**自动拼词典进 prompt（见下）
```

| 文档 | 约束 |
|------|------|
| [`auto-punctuate-intent.md`](./auto-punctuate-intent.md) | R2 **不**把术语库、**翻译词典**、纠错记忆自动拼进标点 prompt |
| [`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md) | **不**将 glossary / correction_memory / **词典** 自动合成复杂 prompt |
| [`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md) | R3t-E 只用 glossary + memory；**非** dictionary |
| [`recording-transcribe-llm-refine-intent.md`](./recording-transcribe-llm-refine-intent.md) | v1 **不做**翻译、摘要；CAT ≠ glossary |

**结论**：词典/翻译是 **CAT-TRAN Epic**；不应在 R3t-E 或 R2 里「顺带做双语」。

---

## 4. 为何没进 §4.1 排期（2026-05-25 起）

| 原因 | 说明 |
|------|------|
| **产品收敛** | Jieyu 计划书第一版：**中文转写 + 校对 + 导出**；翻译/多语 **非 P0–P3 主线** |
| **薄片纪律** | 统一路线图：一轮一纵向薄片；CAT spec 估 **T1–T6 ≈ 多轮**，与 R3h/R3g 发行阻塞并行会稀释 |
| **依赖未齐** | spec 写明 segments 扩展依赖 **文件容器** 稳定；协作批注与 **R6–R8** 有重叠但 CAT 更早需要 UI 面 |
| **密钥与供应商** | 多 MT 引擎 + API Key 管理，与 R3d「三盏灯」相关但 **未**为 CAT 单独立项 |
| **GLY-1 刻意收窄** | 术语管理 UI **不做** CAT 词典，避免 glossary 被富结构污染（spec §10 风险 2 同旨） |

spec 文件**保留**为立项真源；**不等于**已排期。

---

## 5. 候选 Epic — CAT-TRAN

**ID**：**CAT-TRAN**（翻译 + 词典；实施按 spec **T1→T6** 顺序）

### 5.1 子阶段映射（= spec §5）

| 子 ID | Spec | 交付 |
|-------|------|------|
| CAT-T1 | Slice T1 | DB：`target_text`/`target_status`、providers、cache、annotations |
| CAT-T2 | Slice T2 | `translation_cmd` + 引擎抽象 + `translate_file` |
| CAT-T3 | Slice T3 | `dictionary_*` CRUD + glossary 互通 + CSV/JSON |
| CAT-T4 | Slice T4 | 工作页双语视图 + 子范围批注 UI |
| CAT-T5 | Slice T5 | 词典面板 + 术语一致性检查/修复 |
| CAT-T6 | Slice T6 | DOCX 对照/干净稿 + 双语 TXT/SRT |

### 5.2 建议 Go 门槛（立项前）

| # | 条件 |
|---|------|
| G1 | R9 或产品书面确认：**中译英**为下一优先级（非仅中文校对） |
| G2 | 文件容器 + `file_id` 转写链 **已签收**（R3t-B 或等价） |
| G3 | 环境页 **LLM/在线 API Key** 模式可复用到 MT Key（或 spec 修订为独立 MT 页） |
| G4 | 与 **R6–R8 协作批注** 边界书面定稿：CAT 批注是否未来迁入 `revision_events` |

### 5.3 v1 仍不做（继承 spec §10 + 路线图 §8）

- 把 `dictionary_entries` 与 `glossary_terms` **合并为一表**
- 在 R2/R3t prompt 里 **自动注入** 词典
- 字符级 Word Track Changes（方案 C）
- MCP 写词典/翻译字段（路线图 MCP 写操作仍排除）

---

## 6. 与 LEX-MINE 的关系

| | LEX-MINE | CAT-TRAN |
|---|----------|----------|
| 语言 | 中文专名 / 错词 | 中→英（规划默认 en） |
| 表 | glossary + memory | dictionary + segment target |
| 与 ASR | 直接（hotwords） | 间接（可选 sync 到 glossary） |

「glossary 一键升级为词典词条」在 **CAT-T3/T5**；「从纠错推荐进 glossary」在 **LEX-MINE** — **两条互通边，不同 Epic**。

---

## 7. 文档索引

| 文档 | 用途 |
|------|------|
| [`translation-dictionary-module.md`](./translation-dictionary-module.md) | **实施 spec 真源**（API、Schema、UI、验收） |
| [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §8 / §8.1 | 不做 + 候选登记 |
| [`lexicon-mining-backlog.md`](./lexicon-mining-backlog.md) | 中文词表挖掘 / ASR 训练 |
| [`collaboration-review-domain-api.md`](../../architecture/collaboration-review-domain-api.md) | 远期协作批注/Word 导出（与 CAT 批注可能汇合） |

---

## 8. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-27 | 初版：登记 CAT-TRAN；指向既有 spec；对齐路线图 §8 与 R2/R3t 边界 |
| 2026-05-27 | **产品拍板**：远期规划、**当前不做**；重心转写（R3g/e/t） |

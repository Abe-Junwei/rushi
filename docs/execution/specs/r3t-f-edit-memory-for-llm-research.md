# 调研：手改记忆 → 大模型自动改稿参考（Edit Memory for LLM）

> **状态**：已采纳（2026-05-31）  
> **关联**：[`r3t-f-post-transcribe-suite-research.md`](./r3t-f-post-transcribe-suite-research.md)、[`r3t-e-lexicon-proofread-research.md`](./r3t-e-lexicon-proofread-research.md)、[`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)  
> **用户诉求**：用户手动改稿应沉淀为记忆，并在 LLM 自动改稿时作为参考；需弄清业内**具体怎么做**，而非仅「有记忆」口号。  
> **编码**：**MEM 优化未启动** — 实施真源 [MEM Plan](./r3t-f-correction-memory-optimization-plan.md)（D10–D15）；套件 [Plan v4](./r3t-f-post-transcribe-suite-plan.md)。本文保留业内对照深度。  
> **基线（2026-05-31）**：自动保存 1.5s + `saveSegments({ quiet })` 已落地；学习仍仅 `file_save_segments` 后 infer。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 用户在编辑器里把「安波那那」改成「安那般那」、用查找替换批量改正、或在词表校对预览里确认写回。希望**下次**点「AI 校对」或转写后处理时，模型**优先沿用**这些已确认的改法，而不是重新猜谐音或润色全文。 |
| **本仓现状** | **已做**：`correction_memory(before_text, after_text, hit_count, accepted_as_rule)`；`infer_single_replacement` 在 **save 语段**（段数不变）时学习；`collect_correction_rule_hints` → L2 转写 warning；R3t-E **LexiconPack** 将 `hit_count≥2` 或 `accepted_as_rule` 的规则 + `glossary_canonical` 注入 LLM prompt，**evidence 校验** 写回。 **未做**：手改 **未保存** 不学习；**合并/拆分** 不产生记忆；**不把** 原始 diff 片段当 few-shot 塞进 prompt；**无** 项目级「编辑事件」检索（RAG）。 |
| **成功标准** | 手测：同一 wrong→right 手改保存 2 次后，词表校对建议带 `evidence: rule`；用户「采纳为规则」后下次 **无需再改** 该形；LLM **不**因记忆膨胀而改坏高置信句。可自动化：`infer_single_replacement` + Pack 上限 + ungrounded op 丢弃（已有）。 |

---

## 2. 业内成熟路线：手改如何进入「自动改稿」

业内几乎**没有**「把整份手改稿再喂给 LLM 全文重写」作为主流；而是 **多通道、分阶段**，且 **越自动的层越结构化**。

### 2.1 五层模型（对照用）

```text
L1 转写前词表     → 影响 ASR 听写（hotwords / custom vocabulary）
L2 转写后确定性   → wrong→right 字面替换（custom_spelling、规则引擎）
L3 编辑学习入库   → 从手改提取「正确形」或「错→对」对，写入词表/词典
L4 LLM 改稿参考   → 结构化 Pack / few-shot 片段 / 编辑算子 JSON
L5 离线模型适应   → 用户编辑进训练集（黑盒，非产品内可解释记忆）
```

**结论**：手改记忆要服务 LLM，通常落在 **L3→L4**，且 **L1 与 L4 必须分通道**（Rushi 已规定：hotwords 不得塞进 LLM prompt）。ASR 阶段实践与落地见 [`asr-vocabulary-bias-practices.md`](../../docs/architecture/asr-vocabulary-bias-practices.md)。

### 2.2 竞品与 API：具体实现

| 产品 / API | 手改如何被记住 | 如何影响「下一次自动改稿」 | 是否进 LLM prompt |
|------------|----------------|---------------------------|------------------|
| **[Descript](https://help.descript.com/hc/en-us/articles/10249407290637-Transcription-glossary)** Glossary | 预置词表；**同一词改 ≥3 次**（跨项目）可 **自动加入** Transcription Glossary（可关） | **下次转写** ASR/对齐更准；Correct/Correct All 改当前稿 | **否**（转写模型侧 + 编辑器 Correct，非转写后 LLM JSON） |
| **[Descript Correct](https://help.descript.com/hc/en-us/articles/10119613609229-Correct-your-transcript)** | 单次 Correct / Correct All；与 glossary 学习并行 | 当前项目文本 + 媒体对齐；**不**宣称转写后 LLM 全文润色 | 否 |
| **[Sonix](https://help.sonix.ai/en/articles/2789309-can-i-add-specific-words-or-phrases-to-sonix-to-make-my-transcript-more-accurate)** Custom Dictionary | 高亮改正 → 点 **词典（书）图标** **显式入库**；也可在账户页维护 | **以后所有转写** 固定转写为该拼写 | 否（STT 词典通道） |
| **[Otter](https://help.otter.ai/hc/en-us/articles/360047731754-Edit-a-conversation)** | 官方：编辑会用于 **ML 改进未来转写**，**非即时** | 用户须 **手动** 加 [Custom Vocabulary](https://help.otter.ai/hc/en-us/articles/360048571373-Manage-vocabulary) 才能稳定命中 | 否（黑盒 L5 + 显式 L1） |
| **[AssemblyAI](https://www.assemblyai.com/docs/pre-recorded-audio/correct-spelling-of-terms) Custom Spelling** | API 提交 `custom_spelling: [{ from[], to }]`；**非**从 UI 手改自动学习 | 转写完成时 **确定性** 替换 transcript 文本 | 否 |
| **NVivo Transcription Dictionary** | Sounds like → Desired；find/replace 可写入词典 | 后续转写/替换 | 否 |
| **开源 [transcript-fixer](https://github.com/daymade/claude-code-skills/blob/main/transcript-fixer/SKILL.md)** | `--add wrong right`；**≥3 次、≥80% 置信** 的模式从 AI 阶段 **降级到词典** | **Stage 1 词典**（免费）→ Stage 2 LLM；记忆 **优先规则化** | **是**，但以 **规则表** 为主，非全文手改 |

### 2.3 CAT / 翻译记忆（邻近领域）

| 机制 | 代表 | 与「手改→LLM」关系 |
|------|------|-------------------|
| **翻译记忆 TM** | Trados、memoQ | 存 **源句→目标句** 对；新句 **fuzzy match** 给译者/MT；现代工作流用 LLM **补全 fuzzy 差异**（[IntlPull TM Guide](https://intlpull.com/blog/translation-memory-complete-guide-2026)） | **确定性复用**为主；LLM 只改「差分」，不全文重写 |
| **术语库 TB** | 同上 | 强制术语形；违反则 QA 标红 | LLM 作 **术语约束** 校验，非自由改稿 |

**对 Rushi 启示**：口语 **单语转写** 更接近「**错形→正形规则 + canonical 术语**」，而不是 TM 整句对；但 **「有据、可命中、可预览」** 哲学一致。

### 2.4 学术 / 工具链：LLM 如何「参考」手改

| 路线 | 机制 | 可验证链接 |
|------|------|------------|
| **结构化规则 / Pack** | Prompt 内枚举 `wrong→right` + canonical 列表；输出 **带 evidence 的 ops** | 本仓 R3t-E；AssemblyAI custom_spelling 同形 |
| **紧凑编辑算子** | CEGER、NLE：LLM 输出 REPLACE/INSERT 等，**确定性展开** | [CEGER arXiv:2509.14263](https://arxiv.org/abs/2509.14263) |
| **Few-shot 手改样例** | Prompt 附 `{原文片段, 用户改后}` 若干条 | [Few-shot 指南](https://www.prompthub.us/blog/the-few-shot-prompting-guide)；噪声样例会 **降质**（[Cleanlab](https://cleanlab.ai/blog/learn/reliable-fewshot-prompts/)） |
| **反馈检索进 prompt** | 相似输入检索历史 `feedback`，拼进 in-context | [Memory-assisted Prompt Editing, arXiv:2201.06009](https://ar5iv.labs.arxiv.org/html/2201.06009) |
| **词典优先、LLM 兜底** | 先规则替换，再 LLM 扫剩余 | transcript-fixer Stage 1→2 |

---

## 3. 可复用评估（相对 Rushi）

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 冲突 | 结论 |
|------|--------|----------------|---------------|------|
| **A 转写前词表（Descript/Otter/Sonix）** | **高（已有）** | `glossary_terms` → hotwords | **不能**单独解决同音形错 | 手改 **canonical** 应 **F6 提示进 glossary**，不是只进 memory |
| **B 显式错→对词典（Sonix 书图标 / AssemblyAI）** | **高** | `correction_memory` + F1 字面全文 | 中文同音无字面 wrong | **LLM 参考的主形态** = Pack rules |
| **C 隐式 ML 学习（Otter）** | **低** | 用户预期管理文案 | 不可解释、不可预览 | **不做**黑盒 L5 替代 Pack |
| **D LexiconPack + evidence（R3t-E）** | **高（已落地）** | 扩展权重/条数即可 | 同音需 LLM 推断 | **v1 主通道** |
| **E Few-shot 手改片段** | **中** | 最近 N 条 **用户确认** 的 before/after | token 膨胀、脏样例伤害大 | **v2 可选**；须 curated + 上限 |
| **F 编辑事件 RAG** | **低** | — | 隐私、loopback 文案、引用幻觉 | 路线图 **不做**（同 R3t-E §2-F） |
| **G 词典阶段再 LLM（transcript-fixer）** | **中** | high 规则 **Rust 预替换** 再送 E | 实施成本 | **Spike**，非阻塞 |

**本仓已有模块（须扩展，禁止第二套记忆表）**：

| 模块 | 路径 |
|------|------|
| 学习 | `correction.rs`：`infer_single_replacement`、`update_correction_memory_from_save`、`accept_correction_rule` |
| L2 hints | `collect_correction_rule_hints` |
| L4 Pack | `lexicon_pack.rs`、`postprocess_lexicon_ops.rs` |
| 预览写回学习 | `useLexiconProofreadController` 确认后 save → 同上 |

---

## 4. 决策摘要（Rushi 推荐演进）

### 4.1 业内共识（可写进产品文案）

1. **手改记忆服务两条线**：**下次转写更准**（L1 词表 / hotwords）与 **当前稿改准**（L2 规则 + L4 LLM）。  
2. **进 LLM 的形态应是结构化、可校验的**，不是「把用户改过的全文再发一遍」。  
3. **学习要有门槛**：Descript **≥3 次**、本仓 **hit_count≥2** 或 **用户采纳为规则**；避免一次手滑污染 Pack。  
4. **自动改稿仍要预览**：竞品 Correct 与 R3t-E 一致；**无**主流「静默全文 LLM 订正」。

### 4.2 本仓 v1（已对齐业内 B+D）

| 步骤 | 行为 |
|------|------|
| 捕获 | 保存语段时 diff → 单一 `wrong→right`（≤24 字、无空白） |
| 晋升 | `hit_count≥2` → Pack **medium**；`accepted_as_rule=1`（预览勾选）→ **high** |
| 消费 | LexiconPack ≤40 rules + ≤200 glossary → LLM **仅** `update_text` + **evidence** |
| 校验 | Rust 丢弃无 Pack 依据的 op |
| 并行 | glossary → **hotwords**（L2），**不**进 LLM 热词串 |

### 4.3 建议增量（规划纳入 R3t-F，**未编码**）

| 优先级 | 能力 | 对标 | 说明 |
|--------|------|------|------|
| **P1** | **F2 查找替换** 写回后走 **同一 save 学习** | Sonix Correct All + 书图标 | Replace All 确认后须触发 save/学习路径 |
| **P1** | **F6** 第三次命中提示 **加入 glossary** | Descript 自动 glossary | wrong→right **不**自动变 rule；**right** 形进词表 |
| **P2** | Pack 展示「将发送 N 条记忆规则」 | Sonix 词典透明度 | 已有 truncated meta，UI 强化 |
| **P3** | **可选** few-shot：最近 K 条 **用户确认** 的 1 句 before/after | transcript-fixer / MAPLE 思想 | K≤5，仅 `accepted_as_rule`；手测防幻觉 |
| **Spike** | high 规则 **Rust 预替换** 再调 E | transcript-fixer Stage 1 | 省 token、提高字面专名精度 |

### 4.4 不做什么（学习 / LLM）

- **不**把未保存草稿、merge/split diff 写入 memory。  
- **不**把整文件手改历史 RAG 进 prompt（隐私 + 不可校验）。  
- **不**用 LLM 记忆替代 **F1 确定性规则** 或 **F2 手动替换**。  
- **不**期望「全文一次 LLM」因记忆更准（见 R3t-F §4.2 长稿风险）。  
- **不**建 CAT/TM 双语 schema（[`translation-cat-backlog.md`](./translation-cat-backlog.md)）。

---

## 5. 导出 · 分享 · 合并 · 冲突解决（用户新增需求）

### 5.1 问题

用户希望 **纠错记忆 + 术语表** 可 **导出**、**分享给他人/另一台机器**、**合并** 进本机库，且在 **同一 wrong 或同一 term** 不一致时有 **可预期的冲突策略**（非静默覆盖）。

### 5.2 业内怎么做

| 领域 | 导出 | 分享 | 合并 | 冲突解决 |
|------|------|------|------|----------|
| **CAT TM（Trados 等）** | **TMX** / SDLTM 标准文件 ([导出](https://docs.rws.com/en-US/trados-team-859828/exporting-translation-memory-content-741143)) | 文件交换、云 TM 团队库 | 导入 B → A（[社区实践](https://community.rws.com/product-groups/trados-portfolio/trados-studio/f/studio/60157/merging-two-tms-which-have-different-segmentation-rules)） | 导入向导：**目标段不同**时选 *Keep most recent* / *Overwrite* / *Leave unchanged* / *Add new* ([Trados 导入](https://docs.rws.com/en-US/trados-team-859832/importing-translation-memory-content-741139))；字段级 *Overwrite / Leave / Merge values* ([API 文档](https://github.com/RWS/studio-api-docs/blob/main/apiconcepts/translationmemory/importing_a_tmx_file.md)) |
| **术语库 TB** | TBX / CSV | 团队术语服务器 | 导入合并 | 同 term 多译法 → 人工或「主条目优先」 |
| **Descript Glossary** | 帮助文档 **未** 强调通用导出；**Drive 级共享**（≤30 词） | 同 Drive 用户共享；跨 Drive 各自维护 | 无公开「合并两库」 | 自动学习 **≥3 次** 才入库，减少冲突 |
| **Sonix Dictionary** | 账户页维护；改正后 **点图标** 入库 | 账户级「以后转写生效」 | 无多库合并文档 | 用户 **显式** 确认才进词典 |
| **本仓 glossary** | ✅ **CSV 导入/导出**（`useGlossaryImportExport`） | 发 CSV 文件即分享 | 导入时 **重复 term 跳过**（`skippedDup`） | 仅 **去重**，无「同 term 不同 aliases」合并 UI |
| **本仓 correction_memory** | ❌ 无 UI/API | ❌ | ❌ | DB `UNIQUE(before_text, after_text)`；**无**「同 before 不同 after」并存 |

**结论**：消费级转写产品 **很少** 做到 TM 级合并/冲突 UI；Rushi 若要做，应 **借鉴 CAT 导入策略**，用 **开放文件格式 + 合并预览**，而非黑盒云同步。

### 5.3 推荐：Rushi Lexicon Bundle（规划 **F7**，未编码）

**一条包同时携带** `glossary` + `correction_rules`，便于分享；术语表仍可 **单独 CSV**（与现网兼容）。

#### 5.3.1 文件格式 `rushi_lexicon_bundle.v1.json`

```json
{
  "kind": "rushi_lexicon_bundle",
  "version": 1,
  "exported_at_ms": 0,
  "exported_by": { "app": "rushi-desktop", "optional_label": "课题组-A" },
  "glossary_terms": [
    { "term": "安那般那", "aliases": "", "domain": "", "note": "", "hotword_enabled": true }
  ],
  "correction_rules": [
    {
      "before_text": "安波那那",
      "after_text": "安那般那",
      "hit_count": 3,
      "accepted_as_rule": true,
      "updated_at_ms": 0
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `kind` / `version` | 与 `project_bundle` 同类显式契约，便于守卫与迁移 |
| `correction_rules` | 对齐 `correction_memory` 列；**不含** 语段原文（隐私） |
| 可选 v1.1 | `privacy_redact: true` 导出前剔除 note 中含 PII 的项 |

**另提供** `correction_rules.csv`（`before,after,hit_count,accepted,updated_at_ms`）供 Excel 编辑；glossary **继续** 现有 CSV，导入时可「从 bundle 拆出」或双文件 zip。

#### 5.3.2 分享（v1 · 小团队）

| 方式 | 规格 |
|------|------|
| **文件分享** | 导出 `.json` 或 `.zip`（bundle + `README.txt` 一行说明）→ 微信/网盘/邮件；**无** 云同步 |
| **导出过滤（小团队默认）** | 勾选 **「仅稳定记忆」**：`accepted_as_rule=1 OR hit_count≥2`；高级可含 hit=1 |
| **来源标签** | `exported_by.optional_label` 必填建议（如「栏目 A」），合并摘要中展示 |
| **导入入口** | 术语库页：**导入词表包**；合并后全员同一 SQLite 全局库（单机多项目共享） |
| **透明度** | dry-run：`新增 N / 跳过 M / 自动解决 K / 待确认 J` |

#### 5.3.3 合并算法（确定性）

**Glossary（主键 `term`，比较时 `trim` + 可选大小写折叠）**

| 情况 | 默认策略 | 用户可改 |
|------|----------|----------|
| 本地无、包内有 | **插入** | — |
| 完全相同 | **跳过**（`skippedDup`） | — |
| 同 term、字段不同（aliases/note/hotword） | **冲突** | 保留本地 / 采用包内 / **合并 aliases**（集合并去重） |
| 仅 hotword 不同 | 建议默认 **OR**（任一为 true 则启用） | 单选覆盖 |

**Correction rules（主键 `before_text`；库内 `UNIQUE(before, after)`）**

| 情况 | 默认策略 | 用户可改 |
|------|----------|----------|
| 本地无 `(before, after)` 对 | **插入** | — |
| 完全相同 | **累加** `hit_count`（`max` 或 `sum`，实施时二选一并在验收写明）；`accepted_as_rule` = OR | — |
| **同 `before`、不同 `after`** | **拍板（2026-05-31）**：`hit_count` **高者胜**；平手再比 `updated_at_ms`；仍平手 → **冲突预览** | 预览中可改：保留本地 / 采用包内 / 任选一条 |
| 包内多条同 `before` | 导入前 **包内去重**（保留 updated 最新一条） | — |

**合并后**：LexiconPack / F1 / R3t-E **立即** 读新库，无需重开应用。

#### 5.3.4 冲突解决 UI（对标 Trados 导入向导）

1. 用户选文件 → Rust **预演**（dry-run）→ 返回 `{ insert, skip, conflict[] }`。  
2. 无冲突 → 一键合并。  
3. **仅** 预演仍无法消歧的项进冲突对话框（见上：rules 同 before 不同 after 且 hit/时间全平手；glossary 同 term 且策略未选「合并 aliases」仍不一）。  
4. 对话框：每行 **本地值 | 包内值 | 单选**；支持「本批冲突统一策略」。  
5. 确认后事务写入 SQLite；**可撤销** v1.1（非 v1 必须）。

#### 5.3.5 与项目包 / 训练导出边界

| 资产 | 项目 bundle v1 | Lexicon bundle F7 | R4 JSONL（远期） |
|------|----------------|-------------------|------------------|
| 语段/音频 | ✅ | ❌ | 可选脱敏片段 |
| glossary | ❌（全局表） | ✅ | 可引用 term |
| correction_memory | ❌ | ✅ | 需补全 metadata 才合规 |

[`project_bundle`](../../../apps/desktop/src-tauri/src/project/project_bundle_cmd.rs) **不** 夹带词表/记忆（避免每项目重复导出）；用户用 **F7 全局库** 一次导出分享。

### 5.4 可复用评估

| 项 | 复用度 | 说明 |
|----|--------|------|
| glossary CSV 管线 | **高** | 扩展 `glossaryImportFromFile` 识别 bundle 或 zip |
| `correction_memory` 表 | **高** | 合并写 `upsert` + 冲突事务 |
| 新表 | **低（v1 避免）** | 用导入日志 JSON 文件即可，不必 `import_history` 表 |
| 云协作 | **不做 v1** | 对标 Descript Drive，但 Rushi 单人优先 → **文件即分享** |

### 5.5 不做什么（同步）

- v1 **不**做实时多端同步、CRDT、账号词表服务器。  
- **不**在 bundle 内放语段全文或 API Key。  
- **不**在「命中可判定」时仍强制全表预览（仅 **平手/术语字段** 进对话框）。  
- **不**默认无条件的「包覆盖本地」（高者胜是 **规则**，不是偏向包）。  
- **不**与 [`lexicon-mining-backlog.md`](./lexicon-mining-backlog.md) 训练 JSONL 混为一谈（训练需额外 metadata，见该文 G2）。

---

## 6. 记忆生命周期管理（业内机制总览）

用户问的 **冲突解决、蒸馏、合并、精简** 在成熟产品里通常是一套 **「治理流水线」**，而不是单一功能。下表按 **机制类型** 归纳（可验证来源已链入 §2 / §5）。

### 6.1 机制矩阵

| 机制 | 含义（在「改稿记忆」语境） | 业内典型做法 | 消费级转写 | CAT/TM | Rushi 现状 / 规划 |
|------|---------------------------|--------------|------------|--------|-------------------|
| **采集 / 学习** | 从手改提取可复用知识 | save 时 diff；Correct 后点词典；≥3 次自动入库 | Descript/Sonix **显式或计数**；Otter **黑盒** | 译者 **确认** 段写入 TM | ✅ `infer_single_replacement`；❌ split/merge |
| **晋升 / 蒸馏（promotion）** | 多条噪声编辑 → **一条**高置信规则或 glossary 项 | Descript **≥3 次**；transcript-fixer **≥3 次 & ≥80%** → 词典；memoQ 低质量 TU **不晋升** | 有 **计数阈值** | 审校 **role** 高于译者 | ✅ `hit_count≥2`→Pack；F6 **→glossary**；「采纳为规则」 |
| **合并（merge）** | 两库/两文件合成一库 | TMX 导入 B→A；MultiTerm **Merge/Ignore/Overwrite** | 弱（账户级一词典） | **强**（导入向导） | 规划 **F7** + hit 高者胜 |
| **冲突解决** | 同键不同值 | Trados：*Keep recent / Overwrite / Leave / Add new*；memoQ：**master**（User/Role/Recent）+ merge 元数据 | 少；靠 **门槛** 减冲突 | **强** | F7：**hit 高者胜，平手预览**（已定） |
| **去重 /  consolidate** | 同 source 多条 target | Trados「潜在重复」搜索删改；memoQ **Remove Duplicates**；TMX 脚本 **保留最新 TU** | 无公开工具 | **常规维护** | DB `UNIQUE(before,after)`；❌ 同 before 并存 |
| **精简 / 裁剪（prune）** | 控规模、降噪声 | TM **批量删**低质 TU；Pack **Top-N**；术语 **禁止词 / 废弃** | Descript **≤30 词/Drive** 硬上限 | 项目结束 **归档** | Pack **40 rules / 200 glossary** 截断；❌ 用户 prune UI |
| **审核 / 治理** | 人工把关再生效 | MultiTerm **proposed → in review → approved**；禁止词 + preferred | Glossary **团队 Brand Studio** | **标准** | `accepted_as_rule`；预览写回；❌ 工作流状态机 |
| **失效 / 回滚** | 纠错 | 导入 **Keep recent**；TM **Commit** 前可改 | 删 glossary 项 | TM 维护窗口 | undo 语段；❌ 记忆级 undo |
| **模型蒸馏（ML）** | 编辑 → **权重更新** | Otter「未来会更准」；Adapt4Me **校正进 active learning**；LoRA/个性化 ASR | **黑盒**为主 | 非 TM 主线 | 路线图 **不做** training；R4 JSONL **脱敏导出** 仅 |

### 6.2 分项说明（业内「具体怎么做」）

#### 冲突解决（Conflict resolution）

- **导入时策略菜单**（Trados）：目标段不一致 → 保留最新 / 覆盖 / 不动 / 仅新增 ([导入文档](https://docs.rws.com/en-US/trados-team-859832/importing-translation-memory-content-741139))。
- **主条目 + 合并**（memoQ）：duplicate 组选 **master**（按用户、角色、时间、标签数），其余 **merge into master** 而非直接删，避免丢字段 ([memoQ Remove Duplicates](https://docs.memoq.com/12-0/en/Workspace/filter-for-tm-duplicates.html))。
- **Rushi（F7 已定）**：`before` 冲突 → **hit_count 高者胜** → `updated_at_ms` → 仍平手才 UI；glossary 字段冲突仍预览。

#### 蒸馏（Distillation）— 一词多义，需拆开

| 子类 | 做法 | Rushi 对应 |
|------|------|------------|
| **规则蒸馏** | 多次相同改正 → **一条**词典/规则 | `hit_count`、`accepted_as_rule`、F6→glossary |
| **元数据合并蒸馏** | duplicate TU **merge** 到 master，保留创建者/时间 | F7 可选：合并时 `hit_count` 累加、`accepted` OR |
| **Prompt 蒸馏** | 从日志抽 **few-shot** 对进 prompt（K 条） | P3 可选；须 **仅采纳规则** + 上限，防噪声 ([Cleanlab](https://cleanlab.ai/blog/learn/reliable-fewshot-prompts/)) |
| **模型蒸馏** | 校正数据 **微调/LoRA** | [`lexicon-mining-backlog.md`](./lexicon-mining-backlog.md) **不做** v1；Otter 式不可解释 |

#### 合并（Merge）

- **文件级**：TMX 导出 → 导入另一 TM（§5）。
- **条目级**：MultiTerm 两 entry **Merge**，删 redundant doublettes ([MultiTerm merge](https://docs.rws.com/en-US/multiterm-2024-1152755/merging-termbase-entries-348630))。
- **概念级**：terminology **一个 concept 一条**，同义词语在同一 entry（[TerminOrgs Starter Guide](https://www.terminorgs.net/downloads/TerminOrgs_StarterGuide_V2.pdf)）。
- **Rushi**：F7 bundle；glossary **aliases 并集** 策略。

#### 精简（Prune / cap / hygiene）

| 手段 | 业内 | Rushi |
|------|------|-------|
| **硬上限** | Descript 30 词/Drive；Otter 套餐词汇量 | Pack 200/40；可配置 **max_rules** |
| **去重** | TM duplicate 清理 | 同 `(before,after)` 唯一；F7 包内 before 去重 |
| **低质删除** | memoQ：译者 vs 审校 duplicate，留 **高 role** | 规划：**删除 hit_count=1 且未采纳**（F8 候选） |
| **TTL / 归档** | 老项目 TM 归档 | 可选 `updated_at_ms` 超过 N 天降权或不进 Pack |
| **同 before 收敛** | TM 维护：删 duplicate 留最新 target ([Web-Translations 维护文](https://www.web-translations.com/blog/translation-memory-maintenance/)) | F7 高者胜 + 可选 **「合并后删除 loser」** |
| **运行时裁剪** | TM 仅返回 Top fuzzy | `ORDER BY hit_count` + LIMIT（已有） |

#### 治理（Governance）— 比算法更重要

- **状态机**：proposed → review → approved（术语库标准流程，[Adhoc termbase guide](https://www.adhoc-translations.com/blog/how-to-build-a-termbase-guide/)）。
- **角色**：memoQ **Higher role** 赢 duplicate。
- **禁止词 / preferred / DNT**：术语库字段，防误合并。
- **审计**：Trados **Commit Changes**；变更历史 on entry。
- **Rushi 轻量版**：`accepted_as_rule` = 人工批准；预览 = 单次批准；❌ v1 不做完整 workflow。

### 6.3 消费级 vs CAT：管理成熟度

```text
CAT/TM/TBX     ████████████  导入向导、duplicate 工具、merge master、维护文章、概念去重
API (Assembly) ██████        custom_spelling 配置即「冻结规则」，无学习
Descript/Sonix ████          计数晋升 glossary、显式加词典、硬上限
Otter          ██            宣称 ML 学习，几乎无用户可见治理
Rushi 规划     █████~████    F7 合并+冲突；Pack 截断；缺 prune/治理 UI（F8 候选）
```

### 6.4 小团队交换场景（产品定锚 · 2026-05-31）

**典型用户**：3–10 人课题组/栏目组，各自改稿，周期性 **互传词表包**（微信/网盘/邮件），**无** 专职术语工程师、**无** 企业 TM 服务器。

| 需求 | 业内对标 | Rushi 取舍 |
|------|----------|------------|
| **交换载体** | TMX 文件邮件往来；Descript **做不到** Drive 间导出 | **F7 `rushi_lexicon_bundle`** + 可选 zip；**不** 做账号云同步 |
| **合并频率** | 每周/每项目一次导入 | dry-run 摘要：`+12 规则 / 3 冲突 / 跳过 40` |
| **冲突** | 两人改同一专名不同写法 | **hit 高者胜**（已定）；平手预览 — 适合「谁改得多谁赢」 |
| **噪声** | 一人手滑不应污染全队 | 导出默认 **仅** `hit_count≥2` 或 `accepted_as_rule`（可勾选「含单次学习」） |
| **身份** | CAT 记 user/role | bundle `exported_by.optional_label`（如「张三-佛学栏」）— **非** 登录账号 |
| **治理** | MultiTerm 审核流 **过重** | **轻量**：导出前勾选列表；导入后 **不** 自动 `accepted`，仅升 hit |
| **术语 vs 规则** | TB 概念合并 **过重** | glossary 冲突仍 **预览**；小团队更常撞 **规则** 而非概念 doublettes |
| **培训成本** | — | 术语库页一句说明：「词表包 = 术语 + 纠错记忆，不含文稿」 |

**小团队不做**：SSO、权限、审计日志服务器、实时协同编辑记忆、Trados 式 TM 全库维护。

### 6.5 建议纳入 Rushi 路线图（**未编码**）

| 包 | 机制 | 期 | 小团队侧重 |
|----|------|-----|------------|
| **F6** | 晋升蒸馏（→glossary）、`accepted_as_rule` | P1 | 个人积累后再导出 |
| **F7** | 导出、合并、冲突（hit 高者胜） | P2 | **主交付**；过滤导出 + 来源标签 + 合并摘要 |
| **F8 词表卫生**（候选） | 去重、低质 prune、导出前检查 | P2–P3 | **导出前向导**：删 hit=1、同 before 预览、条数预估 |
| **Pack v2** | few-shot（K≤5） | P3 | 非交换刚需 |

**不做 v1**：TM 级 fuzzy、概念 homograph 自动合并、模型 LoRA 蒸馏、团队云库。

---

## 7. 落位预告（编码时）

| 层 | 变更 |
|----|------|
| Rust | `lexicon_bundle.rs`：`export_lexicon_bundle` / `preview_import` / `apply_import`；合并策略纯函数 + 单测 |
| TS | `lexiconBundleApi.ts`、`useLexiconBundleController.ts`；术语库页按钮 |
| 守卫 | `check-architecture-guard`：bundle schema 快照测试 |
| 文档 | Plan **§F7**、acceptance **P2** |

---

## 8. 签收

- [x] 业内 ≥5 条可验证路线（Descript、Sonix、Otter、AssemblyAI、CAT、学术/工具）
- [x] 五层模型 + 与 Rushi 现状/缺口对照
- [x] 推荐演进（F2/F6/Pack v2）与「不做什么」
- [x] **导出/分享/合并/冲突**（§5）+ F7 契约草案
- [x] F7 默认冲突：**同 before 不同 after → hit_count 高者胜，平手才预览**（用户 2026-05-31 选 2）
- [x] **生命周期管理**矩阵（§6）：冲突、蒸馏、合并、精简、治理
- [ ] F7 / F8 编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-05-31 | 初版：手改记忆 → LLM 参考的业内实现调研 |
| 2026-05-31 | §5：Lexicon Bundle 导出/分享/合并/冲突（对标 TM/TBX + 本仓 CSV） |
| 2026-05-31 | **拍板**：规则冲突默认 hit 高者胜，平手才预览 |
| 2026-05-31 | §6：记忆生命周期管理（冲突/蒸馏/合并/精简/治理） |
| 2026-05-31 | §6.4：小团队交换定锚（F7 主交付、稳定记忆导出、F8 导出前检查） |

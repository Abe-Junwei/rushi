# Plan: R3t-F — 转写后后处理与编辑效率（完整规划 v4）

> **状态**：**规划定稿**（2026-05-31）· **F2/F6/自动保存基线 🟡 工作区** · **MEM 优化未编码**  
> **整体性评估 / 排期**：[`r3-asr-voc-holistic-review-2026-05.md`](./r3-asr-voc-holistic-review-2026-05.md)（路线图 **⑤″f**；ASR-VOC 为 L2 子包）  
> **Intent**：[`r3t-f-post-transcribe-suite-intent.md`](./r3t-f-post-transcribe-suite-intent.md)  
> **Acceptance**：[`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md)  
> **调研**  
> - 套件可行性/竞品：[`r3t-f-post-transcribe-suite-research.md`](./r3t-f-post-transcribe-suite-research.md)  
> - 手改记忆 / LLM / 小团队交换：[`r3t-f-edit-memory-for-llm-research.md`](./r3t-f-edit-memory-for-llm-research.md)  
> - **纠错记忆优化（MEM）**：[`r3t-f-correction-memory-optimization-plan.md`](./r3t-f-correction-memory-optimization-plan.md) · [acceptance](./r3t-f-correction-memory-optimization-acceptance.md)  
> **已编码依赖**：R3t-C/D/E（L4）、`correction_memory` + `glossary_terms`（P2）、R3t-E 词表校对（手测签收待办）；**自动保存 1.5s**（`useAutoSaveSegments`）

---

## 0. 文档角色

| 文档 | 用途 |
|------|------|
| **本文（Plan v3）** | 唯一实施真源：分期、包规格、拍板决策、边界 |
| intent | 用户故事与范围一句话 |
| acceptance | 按期的可勾选验收 |
| research ×2 | 业内对照与可行性；编码前已门禁 ✅ |

---

## 1. 产品目标

### 1.1 两条用户路径

| 路径 | 承诺 | 不承诺 |
|------|------|--------|
| **主路径（日常改稿）** | 转写后用 **查找替换（F2）**、**全文规则（F1）**、既有 **R3t-E** 入口；手改沉淀记忆，提升 **下次转写**（hotwords）与 **当前稿 LLM**（LexiconPack） | 一次点击全文 AI 润色；零预览写回 |
| **增强路径（编排）** | **转写后处理（F0-lite）**：默认仅 **规则 + 批处理标点**；可选低置信 **词表/语义 LLM**（F4/F5） | 全文 LLM 段界（D2 前）；宣称等同 Descript「魔法一键」 |

### 1.2 小团队场景（定锚）

**3–10 人** 互传 **词表包**（微信/网盘），合并进各自桌面端 **全局** `glossary_terms` + `correction_memory`。**无** 企业 TM 服务器、**无** 账号云同步 v1。

### 1.3 记忆双通道（硬约束）

```text
glossary_terms ──────► L2 hotwords（下次 ASR 听写）
                         │
correction_memory ─────┼──► L2 转写 hints（warning）
                         │
                         └──► L4 LexiconPack ──► LLM 词表校对 / F1 规则 / F5（禁止塞 hotwords 串进 prompt）
```

手改 → **落库**（手动 / **自动保存 1.5s** / Replace All 后 save）→ `infer_single_replacement`（+ **MEM-P0** 显式 upsert）；**不** 用整稿手改史 RAG；**不** 第二套记忆表。  
**hit 晋升** 与纯自动保存解耦见 MEM Plan **D10**。

---

## 2. 产品拍板决策录（讨论合并）

| # | 决策 | 日期 | 落位 |
|---|------|------|------|
| D1 | **F0-lite 默认只勾** 全文规则（F1）+ 批处理标点（C）；**默认不勾** 词表 LLM（E）、语义（F5）、段界 | 2026-05-31 | §5 |
| D2 | **F5 语义**：仅不通顺/逻辑；禁止风格、扩写、删整段；须预览 + 默认关 | 2026-05-31 | §7 |
| D3 | **主路径优先 F2**（Cmd+F + Replace All 预览），再 F1；F0 不含 F2 | 2026-05-31 | §4 |
| D4 | **全文一次 LLM 订正** 不作为默认精度策略；长稿用分窗/规则/门控 | 2026-05-31 | research §4 |
| D5 | 手改记忆进 LLM = **结构化 Pack**（rules + canonical），非全文重推理 | 2026-05-31 | edit-memory research §4 |
| D6 | **F7 规则冲突**：同 `before` 不同 `after` → **`hit_count` 高者胜** → `updated_at_ms` → 仍平手 **预览** | 2026-05-31 | §10 |
| D7 | **F7 小团队导出**：默认仅 **稳定记忆**（`hit≥2` 或 `accepted_as_rule`）；`optional_label` 标识来源 | 2026-05-31 | §10 |
| D8 | glossary 合并冲突：**预览**（保留本地 / 包内 / 合并 aliases） | 2026-05-31 | §10 |
| D9 | 项目 bundle zip **不含** 词表/记忆；词表用 **F7 包** 单独交换 | 2026-05-31 | §10 |

---

## 3. 能力包索引

| 包 | 名称 | 期 | 依赖 | 状态 |
|----|------|-----|------|------|
| **F2** | 手动查找替换 + Correct 浮层 | P1 | 语段编辑、undo | 🟡 已编码（含改正浮层/高亮/快捷键）；手测待办 |
| **F1** | 全文纠错规则（memory 字面） | P1 | `correction_memory` | 🟡 已编码；手测待办 |
| **F6** | 手改记忆闭环（→glossary 提示） | P1 | save 学习 | 🟡 保存后第 3 次提示已编码 |
| **F0-lite** | 转写后处理编排 | P2 | F1、R3t-C | 未编码 |
| **F4** | 置信门控（ASR + LLM 双轨） | P2 | 段 confidence | 未编码 |
| **F7** | 词表包导出/导入/合并 | P2 | SQLite 全局表 | 未编码 |
| **F8** | 导出前检查（小团队） | P2–P3 | F7 | 候选 |
| **MEM-P0** | 记忆硬化（显式入库、写回即存、hit 策略） | P1·⑤″f-B | save 链、auto-save | 未编码 |
| **MEM-P1** | 记忆管理 UI + 采纳为规则 + LEX-MINE-1 轻量 | P1·⑤″f-B½ | MEM-P0、GLY-1 | 未编码 |
| **MEM-P2** | infer/uid 对齐 + ACC-TXT-0 spike | P2·⑤″f-C | MEM-P0 | 未编码 |
| **F3** | 术语推荐 LEX-MINE-2/3（全量） | P3 | MEM-P1 | 未编码 |
| **F5** | 语义审校（fluency/logic） | P3 | R3t-E 契约 | 未编码 |
| **F0-full** | 含 D2 段界 + F5 的一键增强 | v2 | D2 spike | 未立项 |
| **D2** | 全文/滑窗段界 spike | Spike | R3t-D | 调研 |

**已编码（本 Epic 消费，不重复造）**：R3t-E `postprocess_lexicon_proofread`、LexiconPack、`correction.rs` 学习、glossary CSV 导入导出。

---

## 4. 分期与实施顺序

```text
P1  F2 → F1 → F6 → MEM-P0     日常改稿 + 记忆闭环（硬化）
P1½ MEM-P1                    记忆可观测 + LEX-MINE-1 轻量
P2  F7 → F0-lite → F4 ‖ MEM-P2   小团队交换 + 编排 + L2 预替换 spike
     F8（可与 F7 同轮）
P3  F3（全量 LEX-MINE）、F5、MEM-P3
Spike  D2（全文段界）；MEM-S1（规则预替换）
```

| 期 | 包 | 预估 | 用户可见价值 |
|----|-----|------|----------------|
| **P1** | F2, F1, F6, **MEM-P0** | 12–16d | 改稿效率 + **可靠记忆入库** + 进词表提示 |
| **P1½** | **MEM-P1** | 3–4d | 词典透明度 + 采纳为规则 + 术语推荐列表 |
| **P2** | F7, F0-lite, F4, **MEM-P2**, F8? | 10–14d | 词表包 + 转写后处理 + **更强学习/预替换** |
| **P3** | F3, F5, MEM-P3 | 5–8d | 全量挖掘 + 语义 + 冲突治理 |
| **Spike** | D2, MEM-S1 | ≤3d each | 段界 / 确定性规则消费 |

**编码建议首刀**：**F2**（查找替换），次刀 F1，P2 主交付 **F7**（小团队）。

---

## 5. F2 — 手动查找替换（P1 首刀）

**分工**：F2 = 用户指定查找/替换串；F1 = memory **自动**规则；均无 LLM。

| 项 | 规格 |
|----|------|
| 入口 | 工具栏「查找替换」；`Mod+F`（`busy` 忽略） |
| 面板 | `compactDialog`；查找、替换（可空） |
| 范围 | 当前文件全部语段；操作前 `flushSegmentTextDrafts` |
| 匹配 | 字面、`indexOf`、非重叠；v1 区分大小写 |
| 导航 | `第 k/N 处`；上/下条 → `setSelectedIdx` + 列表滚动 |
| 替换当前 | 一处；`pushUndoForTextEdit` |
| 全部替换 | 预览表 → 确认 → 单次 `pushUndo` 批量写回 |
| 学习 | save → `infer_single_replacement`（同 F6） |

**落位**：`segmentFindReplace.ts`、`useFindReplaceController.ts`、`FindReplaceDialog.tsx`；接 `ProjectPanel` / `EditorSegmentToolbar` / `EditorView`。

**Correct 浮层（P1 同轮或紧随）**：选中文本 → 展示 memory + glossary（不猜谐音）；可选预填查找框。

---

## 6. F1 — 全文纠错规则（P1）

- 源：`correction_memory`，`accepted_as_rule=1 OR hit_count>=2`。
- 算法：段内最长匹配、非重叠、`wrong→right` 字面替换。
- 入口：「应用纠错规则（全文）」；diff 预览 → 确认写回。
- **不做**：glossary canonical 全文自动替换（中文子串/同音风险）。

---

## 7. F6 — 手改记忆闭环（P1）

| 通道 | 机制 |
|------|------|
| L4 LLM | `hit≥2` 或「采纳为规则」→ LexiconPack；R3t-E evidence 校验 |
| L1 转写 | 第 **3** 次同 `right` 形手改 → 提示加入 `glossary_terms`（对标 Descript） |
| 禁止 | 未保存草稿、merge/split、整稿 RAG |

F2 Replace All 写回后须 **save**，与现有路径一致。

---

## 8. F0-lite — 转写后处理（P2）

**标题**：「转写后处理」（非「一键智能」）。

### 8.1 默认勾选（D1）

- [x] 应用纠错规则（F1）
- [x] 补全标点（R3t-C，`已处理 i/N 段`）

### 8.2 默认不勾选

- [ ] AI 词表校对（E，仅低置信段若勾选）
- [ ] AI 语义审校（F5）
- [ ] 整理段界（禁用 + 文案指向 R3t-D 当前窗）

### 8.3 执行顺序

`F1 预览确认 → 批处理 C（可取消）→ 若勾选 E：低置信/阈值段窗 → 预览`

undo：每阶段或最终一次（实施时二选一，写入 acceptance）。

---

## 9. F4 — 置信门控（P2）

| 设置键 | 默认 | 含义 |
|--------|------|------|
| `asr_llm_review_below` | 0.85 | 低于此或 `low_confidence` 才送 E/F5 |
| `llm_apply_min_confidence` | 0.85 | LLM op 写回阈值（轨 2） |

无 ASR 分 → 保守送审。全稿高置信 +「跳过洁净稿」→ 不调 E/F5。

---

## 10. F5 — 语义审校（P3，D2）

- 仅 `update_text`；`kind: fluency|logic` + `confidence`。
- Prompt（D2）：只修明显不通顺/逻辑矛盾；禁止润色、扩写、删段、merge/split、改说话人。
- Rust：超 ±40% 字数变化的 op 丢弃（比例实施时定稿）。
- 完整预览 + 逐条勾选；F0 **默认不勾**。

---

## 11. F7 — 词表包（P2 · 小团队主交付）

### 11.1 格式 `rushi_lexicon_bundle.v1.json`

```json
{
  "kind": "rushi_lexicon_bundle",
  "version": 1,
  "exported_at_ms": 0,
  "exported_by": { "app": "rushi-desktop", "optional_label": "栏目 A" },
  "glossary_terms": [{ "term": "", "aliases": "", "domain": "", "note": "", "hotword_enabled": true }],
  "correction_rules": [{
    "before_text": "", "after_text": "", "hit_count": 0,
    "accepted_as_rule": false, "updated_at_ms": 0
  }]
}
```

- **禁止** 语段正文、API Key。
- 可选 zip：`bundle.json` + `README.txt`（一行说明）。
- glossary 仍可 **单独 CSV**（现有能力）。

### 11.2 导出（D7）

- 术语库页：**导出词表包**。
- 默认勾选 **仅稳定记忆**：`accepted_as_rule OR hit_count≥2`。
- 高级：含 `hit_count=1`。
- 建议填写 `optional_label`。

### 11.3 导入与合并（D6、D8）

1. 选文件 → Rust **dry-run** → `{ insert, skip, auto_resolved, conflicts[] }`。
2. `conflicts.length===0` → 一键应用。
3. 否则 → `compactDialog` 仅 **未自动解决** 项（glossary 字段冲突；rules 平手）。

**合并规则**

| 数据 | 无冲突 | 冲突 |
|------|--------|------|
| rule 同 `(before,after)` | 累加 hit（实施定 sum/max）；`accepted` OR | — |
| rule 同 `before` 异 `after` | **hit 高者胜** → `updated_at_ms` | 仍平手 → 预览 |
| glossary 同 `term` | 跳过（dup） | 预览：本地/包内/合并 aliases |
| 包内同 before 多条 | 导入前包内去重（留最新） | — |

合并后 **立即** 生效：hotwords、F1、R3t-E Pack。

### 11.4 落位

- Rust：`lexicon_bundle.rs` — export / preview_import / apply_import + 单测。
- TS：`lexiconBundleApi.ts`、`useLexiconBundleController.ts`；`GlossaryPage` 按钮。

---

## 12. F8 — 导出前检查（P2–P3 候选）

- 导出向导：条数预览；可选剔除 `hit=1` 且未采纳。
- 同 `before` 多条本地规则：提示清理（与 F7 一致）。
- **非** Trados 级全库维护 UI。

---

## 13. F3 / F0-full / D2（简述）

- **F3**：`correction_memory` 聚合推荐术语 → 勾选入库（LEX-MINE-1）。
- **D2 spike**：全文/滑窗段界；**无 v1 验收**；通过后再 **F0-full**。
- **声学重新分段** = 重跑 L2，文案与 R3t-D 区分。

---

## 14. L2 词表心智

- UI：**「转写词汇表（Custom Vocabulary）」**。
- 转写前 glossary 空 → 轻提示添加专名。
- ASR 偏置业内对照：[`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md)。**实施排期**：[`r3-asr-voc-landing-plan.md`](./r3-asr-voc-landing-plan.md)（VOC-1 与 P1 并行；VOC-2=F6/F7）。

---

## 15. 明确不做

| 类别 | 内容 |
|------|------|
| 架构 | 第二套 memory/glossary 真源；hotwords 进 LLM prompt；无预览流水线 |
| F2 | 正则、跨文件替换、LLM |
| F0/F5 | 默认语义/词表 LLM；全文 LLM 段界 v1 |
| F1 | glossary canonical 全自动全文替换 |
| F7 | 云同步、SSO、bundle 含文稿、静默覆盖本地（无 dry-run） |
| 团队 | 企业 TM 服务器、实时协同记忆 |
| 训练 | `correction_memory` → 训练集 / LoRA（见 lexicon-mining backlog） |
| 宣传 | 「与 Descript 一键相同」 |

---

## 16. 验证

```bash
npm run typecheck && npm run test
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
node scripts/check-architecture-guard.mjs
```

**签收顺序建议**：P1 手测改稿路径 → P2 双人词表包交换 → P2 F0-lite 默认勾选 → P3 F5 边界手测。

---

## 17. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v2 | 2026-05-31 | 可行性修订、F0-lite/F2 拆分 |
| **v3** | 2026-05-31 | **完整规划**：合并拍板 D1–D9、记忆双通道、F7/F8 小团队、edit-memory 调研、分期与首刀顺序 |
| **v4** | 2026-05-31 | **MEM 优化**并入：D10–D15、MEM-P0～S1、自动保存与 hit 解耦、⑤″f 墙钟 4–6w；真源 [`r3t-f-correction-memory-optimization-plan.md`](./r3t-f-correction-memory-optimization-plan.md) |

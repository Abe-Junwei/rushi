# Plan: 纠错记忆优化（MEM）— 并入 R3t-F / ⑤″f

> **状态**：**MEM-P0** ✅ · **MEM-P1** ✅（2026-06-04）— [`mem-p1-hand-test-checklist.md`](./mem-p1-hand-test-checklist.md)  
> **排期真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.1 **⑤″f**、§1.7  
> **套件真源**：[`r3t-f-post-transcribe-suite-plan.md`](./r3t-f-post-transcribe-suite-plan.md) **v4**  
> **调研**：[`r3t-f-edit-memory-for-llm-research.md`](./r3t-f-edit-memory-for-llm-research.md) §2–4、§4.3  
> **Acceptance**：[`r3t-f-correction-memory-optimization-acceptance.md`](./r3t-f-correction-memory-optimization-acceptance.md)  
> **代码真源（现状）**：[`correction.rs`](../../../apps/desktop/src-tauri/src/project/correction.rs)、`file_save_segments` → `update_correction_memory_from_save`；前端 `saveSegments` / `useAutoSaveSegments`（1.5s 防抖）

---

## 0. 背景：自动保存后的行为变化

| 项 | 现状（2026-05-31 代码） |
|----|-------------------------|
| **持久化** | 手动保存、自动保存（`quiet`）、查找替换后保存 — 均走 `file_save_segments` |
| **学习触发** | 同上；**无**独立前端写 memory API |
| **风险** | 停笔即落库 → `infer_single_replacement` 可能对**半成品 diff** 计 `hit_count`；与 Descript「≥3 次才进 glossary」的**意图计数**不完全一致 |

**拍板方向（R-MEM-SAVE + D11–D12，见 §2）**：每次落库带一种 **保存意图**；**背景保存**只保语段，**确认型保存**才学记忆且 **立即** 落库（原 D10/D13 已并入 R-MEM-SAVE）。

---

## 1. 目标与非目标

### 1.1 目标

1. **采集**：用户明确改稿路径（Replace All、采纳为规则、改正应用）**稳定入库**，不依赖 infer 偶然成功。  
2. **晋升**：`hit_count` / `accepted_as_rule` / F6 进 glossary 与 **自动保存解耦或去重**，可解释。  
3. **消费**：L2 从「仅 hint」演进到可选 **确定性预替换**（Spike）；L4 保持 LexiconPack + evidence。  
4. **可观测**：记忆条数、删除、冲突 — 对标 Sonix Custom Dictionary 透明度。

### 1.2 非目标（维持路线图 §8）

- 第二套 memory 表；错形进 hotwords；全文手改 RAG；静默 LLM 改稿；训练集 / ASR-FT。

---

## 2. 产品拍板（MEM，2026-05-31）

### 2.0 R-MEM-SAVE — 保存意图（统一规则，取代 D10/D13 分拆）

> **一句话**：**背景保存**只写语段；**确认型保存**在同一回合 **立即 quiet 落库** 且 **才更新纠错记忆**。

| 保存意图 | 典型触发 | 语段落库 | 纠错记忆 | 前端参数（现状） |
|----------|----------|----------|----------|------------------|
| **`draft`** | 防抖自动保存（停笔 ~1.5s） | ✅ 立即 `quiet` | ❌ 不学、不计 hit | `saveSegments({ quiet: true, countHits: false })` |
| **`confirmed`** | 手动保存；F2 全部替换确认；F1 规则写回确认；段间「确认并下一段」等 | ✅ **同一回合** 落库（批量工具 **不** 等自动保存） | ✅ 计 hit / 显式对 | `quiet` + `countHits: true`；F2 另传 `explicitPairs` |
| **`explicit_only`** | F6「纳入更正记忆…」弹窗确认 | 可选（与语段保存无关） | ✅ `correction_memory_save` | 不经 `countHits` 链 |

**三条硬规则**（手测 / code review 只认此表，不再单独记 D10、D13）：

1. **`draft` 不学记忆** — 自动保存不得因 diff 推断而增加 `hit_count`（对标 Descript：计数跟「确认」，不跟「停笔」）。
2. **批量写回必须 `confirmed`** — F1/F2 等「预览 → 确认写回」后，**必须** 立刻 `saveSegments({ quiet: true, countHits: true, … })`；禁止只改 UI state 再等 `draft`（对标 Sonix Correct All 即时生效）。
3. **`confirmed` 才计命中** — 手动保存与批量确认共用 `countHits: true`；Replace All 另用 `explicitPairs` 显式 upsert（见 **D11**）；F6 走 **`explicit_only`** API。

**实现映射（MEM-P0）**：`countHits` ≈ 是否允许「保存前后 diff → infer」；`explicitPairs` ≈ 用户已点名的 `错形→正形`；`quiet` ≈ 是否 toast（与是否学记忆正交）。

| 旧 ID | 并入 |
|-------|------|
| **D10** | R-MEM-SAVE 规则 1 + 3 |
| **D13** | R-MEM-SAVE 规则 2（`confirmed` 子集） |

### 2.1 其它拍板

| ID | 决策 | 对标 |
|----|------|------|
| **D11** | **Replace All**、**改正应用并保存**、**F1 确认写回** 后：除 infer 外支持 **`upsert_correction_memory` 显式**（`before=find, after=replace`） | Sonix 书图标、AssemblyAI custom_spelling |
| **D12** | **F1 / 改正 / F1 预览** 提供 **「采纳为规则」** → `accept_correction_rule` | Sonix dictionary |
| **D14** | **LEX-MINE-1** 提前至 **⑤″f-B½**；F6 弹窗保留；**不**静默入库 | Descript 3 次 + 显式确认 |
| **D15** | **ACC-TXT-0** 降为 **MEM-P2 Spike** | transcript-fixer Stage1、AssemblyAI |

### 2.2 晋升阶梯（Descript 对齐 · 产品北向）

> **原则**：**计数跟「确认」**（R-MEM-SAVE `confirmed` / F6 `explicit_only`），**不跟停笔**；**进术语表（L1）比进 F1 规则更保守**。

| 阶段 | 条件 | 用户可见 | 消费（L2/L4） | Descript 对照 |
|------|------|----------|---------------|---------------|
| **记录** | 第 1 次 `confirmed` 或 F6 纳入 | 纠错记忆表有行，`hit=1` | Pack **不进**；F1 **不**扫 | 尚未进 Transcription Glossary |
| **稳定规则** | **`hit_count ≥ 3`** 或 **采纳为规则** | 表内「已稳定」；可删可管（MEM-P1 UI ✅） | **F1** 全文替换；LexiconPack；**LEX-MINE-1** 推荐进表 | 满 3 次自动术语表（MEM-P0）；管理/挖掘在 B½ |
| **进术语表提示** | **`hit_count ≥ 3`** 且术语库 **无** 该 **正形** | **GlossaryLearnPrompt** 弹窗（须点「加入词汇表」） | 确认后 → `glossary_terms` → **下次转写 hotwords** | [Transcription Glossary](https://help.descript.com/hc/en-us/articles/10249407290637-Transcription-glossary) **同一词改 ≥3 次可自动入库（可关）** |
| **显式规则** | 用户点 **采纳为规则** | 立即 stable | Pack **high**；F1 立即可用 | 强于纯计数 |

**代码现状（2026-06）**

| 阶梯 | 状态 | 真源 |
|------|------|------|
| 稳定 `hit≥2` | ✅ | `correction_store.rs` · F1 `list_stable_correction_rules` |
| F6 第 3 次进表 **提示** | ✅ | `list_glossary_learn_prompts`（`hit_count >= 3`）· [`f6-f6plus-mem-hand-test-checklist.md`](./f6-f6plus-mem-hand-test-checklist.md) §B |
| LEX-MINE-1 推荐列表 | ✅ MEM-P1 | `GlossaryMineSection` + `useGlossaryMineController` |
| Descript 式 **满 3 次自动进 glossary（可关）** | ✅ MEM-P0 | 默认 **开**（自动进表）；可选设置项延后 |

**不做什么（Descript 差异 intentional）**

- **不**在 `hit=1` 时静默进 glossary 或静默跑 F1。  
- **不**把 `before_text`（错形）进 hotwords（仅 **正形** `after_text` / glossary `term`）。  
- **不**在 MEM-P0 做「跨项目自动挖词」；全量语料 **LEX-MINE-2+** 仍 §8.1 候选。

---

## 3. 能力包索引（MEM）

| ID | 名称 | 期 | 估时 | 依赖 |
|----|------|-----|------|------|
| **MEM-P0** | 记忆硬化：显式 upsert + 写回即存 + hit 策略 | ⑤″f-B | 2–3d | F2 save 链、auto-save 已落地 |
| **MEM-P1** | 记忆管理 UI + 采纳为规则入口 + LEX-MINE-1 轻量 | ⑤″f-B½ | 3–4d | MEM-P0、GLY-1 |
| **MEM-P2** | infer 扩展 + uid 对齐学习 + ACC-TXT-0 spike | ⑤″f-C | 4–6d | MEM-P0、R3t-B |
| **MEM-P3** | `before` 冲突预览、accepted few-shot K≤3 | P3 / ⑤″f 后 | 3–5d | R3t-E 稳定 |
| **MEM-S1** | high 规则 Rust 预替换（转写后 / F0 前） | Spike | ≤3d | MEM-P0、list_stable_rules |

**与 R3t-F 包关系**：不替代 F2/F1/F6/F7；**穿插**在 ⑤″f-B～C。

---

## 4. MEM-P0 — 记忆硬化（⑤″f-B 与 F1/F6 同轮）

### 4.1 Rust

| 项 | 规格 |
|----|------|
| `correction_record_explicit` | 新 command 或 `file_save_segments` 可选 payload `explicit_pairs: [{before, after}]`；与 infer 并行 upsert |
| `save_segments` hit 策略 | 新增 `count_hits: bool`（默认：手动/显式 true，auto-save false） |
| 日志 | `correction_memory_update_failed` 保留；可选 `correction_memory_learned n=` info |

### 4.2 前端（按 R-MEM-SAVE 意图）

| 路径 | 意图 | 行为 |
|------|------|------|
| 自动保存 | `draft` | `save({ quiet: true, countHits: false })` |
| 手动保存 | `confirmed` | toast + `countHits: true` |
| Replace All 确认 | `confirmed` | `explicitPairs` + `save({ quiet: true, countHits: true })` |
| F1 确认写回 | `confirmed` | 写回 state → **同回合** `save({ quiet: true, countHits: true })` |
| F6 纳入记忆 | `explicit_only` | `correction_memory_save`（不经 countHits） |

### 4.3 验收要点（R-MEM-SAVE）

- [ ] Replace All「智控→制控」后 DB 有 pair 且 hit≥1（显式或 infer 至少其一）  
- [ ] 仅 `draft`（自动保存）、无 `confirmed`：不增加 hit  
- [ ] F1 `confirmed` 写回后 1s 内 DB 与 UI 一致（无需等 `draft` 防抖）

---

## 5. MEM-P1 — 可观测与晋升（⑤″f-B½ · Descript 体验补全）

| 项 | 规格 | Descript 对标 |
|----|------|---------------|
| **记忆管理** | 列表 `wrong→right`、`hit_count`、`accepted`；删除；与 stable 规则同源 | 词典透明度 |
| **采纳为规则** | F1 预览、改正结果行 — `correction_accept_rule` | 显式词典项 |
| **LEX-MINE-1** | 术语页「记忆推荐」：`hit≥2` 或 accepted、未在 glossary；**批量**采纳 / 忽略 | 减少只靠第 3 次弹窗才发现 |
| **自动进表（可选）** | 设置：**「正形 hit≥3 时自动加入术语表」** 默认 **关**；开则跳过 GlossaryLearnPrompt（仍写 note 来源） | Transcription Glossary 自动添加（可关） |
| **F6 文案** | 「多次改正的正形可进术语表，改善**下次转写**」 | 区分 L1 vs F1 当前稿 |

---

## 6. MEM-P2 — 算法与 L2 消费（⑤″f-C，可与 F7 并行）

| 项 | 规格 |
|----|------|
| **uid 对齐** | split/merge 后按 uid 匹配旧新段再 infer（禁止段数不等时全 skip） |
| **infer 放宽** | 无换行即可；长度上限可提到 32 字；多 hunks 每 hunk 一条（可选） |
| **ACC-TXT-0 spike** | 转写写库后或 F0-lite 步骤 0：`list_stable_rules` 字面替换 segments；预览 diff；**不**进 hotwords |

---

## 7. MEM-P3 / MEM-S1（延后）

- **MEM-P3**：F7 已含 D6 冲突；MEM-P3 补 **编辑台内** 同 before 冲突预览。  
- **MEM-S1**：仅 `accepted` 或 `hit≥3` 规则；段内最长匹配；与 `collect_correction_rule_hints` 去重。

---

## 8. 调整后 ⑤″f 顺序（与路线图一致）

```text
⑤″f-A   VOC-1 ‖ F2(🟡) ‖ VOC-5
⑤″f-B   F1 + F6 + L2文案 + MEM-P0
⑤″f-B½  MEM-P1（管理 UI + LEX-MINE-1 轻量）
⑤″f-C   F7 + F0-lite? ‖ MEM-P2（可与 F7 并行）
⑤″f-D   VOC-3
Spike   MEM-S1（不阻塞 F7）
P3      F3 全量 LEX-MINE-2/3、F5、MEM-P3
```

**墙钟**：⑤″f 由 **3.5–5 周** 调整为 **4–6 周**（+MEM-P0/P1 **~1w**）；仍单人薄片。

---

## 9. 验证

```bash
npm run typecheck && npm run test
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml correction
node scripts/check-architecture-guard.mjs
```

Rust 单测：`infer_single_replacement` 边界 + `update_correction_memory_from_save` 段数 gate + 显式 upsert。

---

## 10. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1 | 2026-05-31 | 自对话优化建议并入 R3t-F；D10–D15；MEM-P0～S1 分期 |
| v2 | 2026-06-04 | **R-MEM-SAVE** 统一保存意图；D10/D13 并入 §2.0，手测只认三条硬规则 |
| v3 | 2026-06-04 | **§2.2 晋升阶梯** Descript 北向；MEM-P1 补 LEX-MINE-1 + 可选「hit≥3 自动进表」 |

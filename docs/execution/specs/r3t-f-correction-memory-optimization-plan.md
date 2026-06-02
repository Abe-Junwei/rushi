# Plan: 纠错记忆优化（MEM）— 并入 R3t-F / ⑤″f

> **状态**：规划定稿（2026-05-31）· **未编码**（MEM-P0 起）  
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

**拍板方向（D10–D12，见 §2）**：自动保存 **继续负责落库**；**晋升 hit / 显式入库** 与「用户确认型操作」对齐业内 Sonix/Descript。

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

| ID | 决策 | 对标 |
|----|------|------|
| **D10** | **自动保存**：`file_save_segments` **计持久化**；**`hit_count` 累加** 默认仅 **显式路径**（手动保存、Replace All 确认保存、写回后 `quiet save`）及 **infer 成功** 的显式 upsert；纯防抖自动保存 **可配置默认不计 hit**（实施二选一写入 acceptance） | Descript 计数 vs Otter 黑盒 |
| **D11** | **Replace All**、**改正应用并保存**、**F1 确认写回** 后：除 infer 外支持 **`upsert_correction_memory` 显式**（`before=find, after=replace` 或段级聚合对） | Sonix 书图标、AssemblyAI custom_spelling |
| **D12** | **F1 / 改正 / F1 预览** 提供 **「采纳为规则」** → `accept_correction_rule`（与 R3t-E 勾选同源） | Sonix dictionary |
| **D13** | **F1 / 纠错规则写回** 后 **必须** `saveSegments({ quiet: true })`（不弹 toast），不依赖 1.5s 自动保存 | Correct All 即时生效 |
| **D14** | **LEX-MINE-1** 提前至 **⑤″f-B½**（术语页「记忆推荐」列表）；F6 弹窗保留；**不**静默入库 | Descript 3 次 + 显式确认 |
| **D15** | **ACC-TXT-0**（稳定规则转写后字面替换）降为 **MEM-P2 Spike**，通过后再进 §8.1 候选或 F0-lite 默认勾 | transcript-fixer Stage1、AssemblyAI |

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

### 4.2 前端

| 路径 | 行为 |
|------|------|
| Replace All 确认 | `explicit_pairs` 或逐段 upsert + `save({ quiet, countHits: true })` |
| F1 确认写回 | 写回 → **`save({ quiet: true })`** |
| 改正 → 查找替换 → 用户替换 | 同 F2；或「应用建议」单段替换 + quiet save |
| 自动保存 | `save({ quiet: true, countHits: false })` |
| 手动保存 | `save` → toast「保存成功」+ `countHits: true` |

### 4.3 验收要点

- [ ] Replace All「智控→制控」后 DB 有 pair且 hit≥1（显式或 infer 至少其一）  
- [ ] 仅自动保存、无手改：不增加 hit（若采用 D10 方案 A）  
- [ ] F1 写回后 1s 内 DB 与 UI 一致（无需等 1.5s）

---

## 5. MEM-P1 — 可观测与晋升（⑤″f-B½）

| 项 | 规格 |
|----|------|
| **记忆管理** | 术语库页或环境子页：列表 `wrong→right`、`hit_count`、`accepted`；删除；只读上限 80 条与 stable 规则同源 |
| **采纳为规则** | F1 预览、改正结果行、（可选）语段工具栏 — 调 `correction_accept_rule` |
| **LEX-MINE-1** | SQL 聚合推荐（`hit≥2` 或 accepted，未在 glossary）；批量采纳进 glossary / 忽略（降权表或 localStorage dismiss 扩展） |
| **F6 文案** | 强调「正形进术语表、改善下次转写」；非 SQLite 技术用语 |

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

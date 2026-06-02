# 调研：中文改词 diff / 纳入记忆文本算法整改

> **状态**：已采纳（2026-06-02）  
> **关联**：[r3t-f-edit-memory-for-llm-research.md](./r3t-f-edit-memory-for-llm-research.md)、[r3t-f-correction-memory-optimization-plan.md](./r3t-f-correction-memory-optimization-plan.md)  
> **实施**：`services/text/grapheme.ts`、`services/text/singleReplacement.ts`、`learnEditDelta.ts`、`revisionDiff.ts`

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 中文口语转写中，用户选中四字短语（如「二六十中」）改为同音异字（「而六时中」），期望「将纳入记忆」展示整词对；实际 diff 仅显示「十→时」。 |
| **根因** | ① LCS 按字素对齐，共享字「六」「中」被标为 equal；② 公共前缀/后缀剥离把末尾「中」当 unchanged；③ `insertReplacementText` 未记录选区 deleted；④ diff 回退优先于操作追踪。 |
| **约束** | 单字 CJK 不自动学习（产品策略）；Rust save 与 TS 前端 explicit_pairs 须一致；语段长度通常 ≤80 字。 |

---

## 2. 业内对照

| 路线 | 机制 | 复用度 |
|------|------|--------|
| **Descript / Sonix 词典** | 用户显式改词入库，非 LCS 推断 | 高 — 本仓 `correction_memory` + explicit_pairs |
| **Myers diff / git diff** | 块级 replace 优先 | 中 — 仅适合展示，不适合中文同音短语学习 |
| **IME 操作日志** | beforeinput 删+插 | 高 — `learnEditDelta` 主路径 |
| **Unicode TR29 grapheme** | `Intl.Segmenter` | 高 — 字素切分真源 |

**不做什么**：不用 LCS 作为纳入记忆唯一真源；不引入第二套 Rust diff 栈。

---

## 3. 决策

1. **纳入记忆真源**：`beforeinput` 追踪 > 合法整段替换窗口择优 > LCS 展示。  
2. **字素模块**：`splitGraphemes` / `graphemeCount`（`Intl.Segmenter('zh')`）。  
3. **候选择优**：`isValidSingleReplacement` + 后缀语境优先（避免波那那→那般那）。  
4. **交错 LCS**：`phrasePairFromInterleavedRegion` 仅「先插后删 + 短 equal 夹心」；尾字扩展需 `lastRemoved !== tailChar`。  
5. **Rust**：有 `explicit_pairs` 时跳过 `infer_single_replacement` 自动学习，防双写。  
6. **deleteWord\***：无空白的中文文本退化为单字删除追踪。

---

## 4. 落位

| 层 | 文件 |
|----|------|
| 字素 | `apps/desktop/src/services/text/grapheme.ts` |
| 替换窗口 | `apps/desktop/src/services/text/singleReplacement.ts` |
| 操作追踪 | `learnEditDelta.ts` |
| diff 展示+回退 | `revisionDiff.ts` |
| 实时条 | `pendingLearnRevision.ts` |
| 保存 | `segment_cmd.rs`（explicit_pairs 优先） |
| 回归 | `chineseEditMemoryMatrix.test.ts` |

---

## 5. 验证

```bash
npm run typecheck && npm run test -- apps/desktop/src/services/chineseEditMemoryMatrix.test.ts
```

手测：选中「二六十中」→ 输入「而六时中」→ 右侧条显示整词对；单改「十」→「时」显示「单字」不计入。

# Plan：语段正文行模型对齐（彻底消除 merge 丢字 + 远期风险）

> **状态**：编码中（S0–S5 已实施，待手测签收）  
> **Research**：[`segment-text-input-p0-research.md`](./segment-text-input-p0-research.md) · 会话诊断 2026-06（merge/draft 三层同步）  
> **关联**：[`rev-loc-undo-edit-history-research.md`](./rev-loc-undo-edit-history-research.md) · [`segment-annotation-research.md`](./segment-annotation-research.md) §4.2 合并规则  
> **Acceptance**：[`segment-text-row-model-acceptance.md`](./segment-text-row-model-acceptance.md)（编码前须补齐勾选）  
> **门禁**：按薄片顺序实施；每薄片结束 `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

---

## 1. 要彻底解决什么

### 1.1 当前问题（必须归零）

| ID | 症状 | 根因 |
|----|------|------|
| **T1** | 与上/下一条合并后正文丢失或回退 | `segments[].text` 与 draft/DOM 分叉；结构变更前未物化 |
| **T2** | 偶发、难复现的「合并少一侧编辑」 | `segmentsRef` 超前于 React state；`uid#idx` reindex 后 orphan |
| **T3** | IME 组字中合并丢拼音 | composing 跳过 flush；DOM 未 sync |
| **T4** | 右键合并 vs 快捷键合并行为不一致 | 入口多、commit 链不统一 |

### 1.2 已识别的远期风险（本计划一并收口）

| ID | 风险 | 若不处理 |
|----|------|----------|
| **L1** | 三层真源（DOM / draft / segments）长期共存 | 每增一个 mutation 入口回归 T1 |
| **L2** | `segmentDraftKey = uid#idx` | 删/并/插后 draft 键错位 |
| **L3** | 合并在波形、`Cmd+M` 不进 textarea | 与 Otter/Trint 心智不符；漏测路径 |
| **L4** | 拆分全文留左半 | 用户误以为「丢字」（体验债） |
| **L5** | 段内换行 normalize 为空格、段间 merge 用 `\n` | 导出/合并语义不一致 |
| **L6** | 转写 delta / LLM 批量写回与手编并发 | 覆盖未 flush 或已 commit 正文 |
| **L7** | ≥200 语段虚拟列表 | 离屏行无 DOM，只能靠 store/state |

### 1.3 「彻底」的定义（验收口径）

**A 类（本计划承诺彻底）**：用户在 **非 busy** 下手编语段正文，经 **任意合并/拆分/删除/插入入口**，合并结果包含 **全部可见正文**；无关语段 reindex 后不丢编辑。

**B 类（本计划只建契约，不承诺彻底）**：转写/LLM 覆盖、busy 中断、误 undo — 单独文档 + 测试，不在 A 类口径内。

---

## 2. 目标架构（终态）

```text
选中行编辑：
  onInput / compositionEnd  ──►  segments[i].text（唯一写路径）
  不再写 segmentDraftStore（选中行）

非选中行：
  只读 committed；无活跃 draft

结构变更（merge/split/delete/insert）：
  prepare（IME end + DOM scan 兜底）
  → materialize 全表
  → flushSync(setSegments)
  → clearCommittedDrafts + pruneDraftKeys
  → pushUndo → 结构操作

持久化：
  blur / debounced autosave / 显式保存 → SQLite（不变）
  undo：1.2s 合并 pushUndoForTextEdit（不变）
```

**与业内对齐点**：Subtitle Edit / Otter 的「格内/段内编辑 = 行模型真源」+ Trint 段界 Backspace/Enter；**不**做 Descript 单篇 Script / 媒体 edit boundary。

---

## 3. 薄片路线图（五步走 + 远期契约）

### 薄片 S0 — 结构变更纪律（P0）✅ 已落地

**目标**：任何改变 `segments.length` 或 reindex 的操作，必先 `commitSegmentTextDraftsForStructureMutation`。

| 落位 | 状态 |
|------|------|
| `segmentMutationMergeDelete.ts` merge/delete | ✅ |
| `useSegmentSplitController.ts` | ✅ |
| `segmentMutationInsert.ts` | ✅ |
| `flushSegmentTextDrafts.ts` + `useSegmentDraftStore.ts` helpers | ✅ |

**验收**：`useSegmentMutationController.mergeDelete.test.ts` · `core.test.ts`（split draft）· `flushSegmentTextDrafts.test.ts` 全绿。

**未达标不进入 S1**：S0 单测 CI 绿 + 手测清单 M1–M4（acceptance §2）。

---

### 薄片 S1 — 选中行行模型单写路径（P2 核心）✅ 已落地

**目标**：选中语段 `onInput` / `compositionEnd` 同步更新 `segments[i].text`；选中行不再写 draft store。

| 层 | 文件 | 变更 |
|----|------|------|
| Hook | `useSegmentRowTextFieldEditing.ts` | input → `updateSegmentText(i, text, { silent: true })` 或等价 ref 批写；移除选中行 `setDraft` 主路径 |
| Controller | `useSegmentMutationController.ts` | `updateSegmentText` 支持 `silent`（跳过 pushUndoForTextEdit） |
| Store | `useSegmentDraftStore.ts` | 保留 store 供 **非选中行/脏读过渡**；文档标注选中行不再写入 |
| UI | `SegmentRowTextField.tsx` | 评估受控 `value` vs sync-on-input；须过 P0 手测 H1–H5 |
| 脏读 | `segmentDirtyRead.ts` | 继续 `materializeSegmentTextDrafts`（过渡）或直读 segments |

**测试（新增）**：

- 编辑中 `mergeWithNextAt` **不调用** flush 仍 pass（证明 segments 已新）
- 双端 draft 用例改为「仅非选中/历史兼容」或删除

**性能闸门**：[`segment-text-input-p0-hand-test-checklist.md`](./segment-text-input-p0-hand-test-checklist.md) H1–H5 不退化；页脚仍 throttle/defer。

---

### 薄片 S2 — Draft 键与 reindex（P1 模型，**消除 L2**）

**目标**：reindex 后不再依赖 `uid#idx` 命中旧草稿。

**方案（二选一，推荐 A）**：

| 方案 | 做法 | 取舍 |
|------|------|------|
| **A（推荐）** | S1 后选中行无 draft；结构 commit 时 `pruneDraftKeysForSegments`；非选中仅 blur 遗留 draft 随 commit 物化并 prune | 改动小 |
| **B** | draft 键改为 `uid` only；idx 仅 UI 映射；`migrateDraftKeysOnReindex(old, new)` | 支持离屏 draft，复杂度高 |

**落位**：`useSegmentDraftStore.ts` · `flushSegmentTextDrafts.ts` · 若 B：`segmentListHelpers.reindexSegments` 钩子。

**验收**：合并 unrelated 段后，远处语段文本 + 无 orphan draft 单测。

---

### 薄片 S3 — 段界合并交互（P1 交互）✅ 已落地

**目标**：与 Otter/Trint/Subtitle-Editor 对齐：段首 Backspace、段尾 Delete 触发 merge；与右键 / `Cmd+M` **共用** `commit + mergePairWithLiveText`。

| 落位 | 变更 |
|------|------|
| `useSegmentRowTextFieldPointerHandlers.ts` 或 `useSegmentRowTextFieldEditing.ts` | 段界键检测 + 调用 mutation |
| `useSegmentKeyboard.ts` | 文档化：`Cmd+M` 仍波形；段界以 textarea 为准 |
| `segmentMutationMergeDelete.ts` | 导出 `mergeAtBoundary(idx, 'prev'|'next')` 供 UI 复用 |

**验收**：E2E 或 RTL — 光标段首 Backspace 合并且保留两侧正文。

---

### 薄片 S4 — 拆分语义与归一化（P2）✅ 已落地

**目标**：

1. **拆分**：`splitAtPlayhead` / 语段内 Enter（若做）按光标 **比例分配文本**（对齐 Subtitle-Editor Enter），右半不再恒空。
2. **归一化**：文档化「段内 `\n` → 空格；段间 merge 用 `\n`」；导出前 optional 不二次破坏。

| 落位 | 变更 |
|----|------|
| `segmentListHelpers.buildSplitPair` | 增加 `splitTextAtRatio` 参数 |
| `useSegmentSplitController.ts` | 读 textarea selection / playhead 比例 |
| `CONTEXT.md` / architecture 一句 | 合并/拆分文本语义 |

**验收**：split 用例 — 左/右文本按长度或光标比例；非「全文在左」。

---

### 薄片 S5 — 异步写回契约（L6）✅ 已落地（转写 delta 写前 materialize）

**目标**：转写 delta、LLM Stage B、find-replace 全量替换 **写回前** 强制 `flushSegmentTextDrafts` 或 abort 若 busy；禁止仅写 `segmentsRef`。

| 落位 | 变更 |
|----|------|
| `transcribeLocalJobRun.ts` · `usePostTranscribeStageBController.ts` · `useFindReplaceMutations.ts` | 写前 flush；统一 `setSegments` |
| `docs/execution/reviews/chains/project-load-transcribe-save.md` | 补并发矩阵一行 |

**验收**：手编 draft 存在时 mock 转写 delta → 要么先 flush 要么拒绝覆盖（产品择一，写入 acceptance）。

---

## 4. 不做什么

- Descript 式「合并 = 改媒体 edit boundary / realign」
- 整篇 ProseMirror / CodeMirror 单文档（P0 research 已否决）
- 每键 SQLite 或每键 undo 快照
- 本计划内不做 speaker diarization / 在线协作 CRDT

---

## 5. 验证总表

| 阶段 | 命令 / 手测 |
|------|-------------|
| 每薄片 | `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` |
| S1+ | `useSegmentMutationController.*.test.ts` · `flushSegmentTextDrafts.test.ts` · `segmentConfirmEligible.test.ts` |
| S3+ | `segment-text-row-model-hand-test.md`（从 P0 checklist 扩展 M 项） |
| 发布前 | 长文件 ≥200 段虚拟列表：编辑→滚动→合并 |

---

## 6. 依赖与顺序

```text
S0（纪律）──► S1（行模型）──► S2（draft 键）
                    │
                    ├──► S3（段界 merge）
                    └──► S4（拆分语义，可并行于 S3）
S5（异步契约）可与 S1 并行，但 **发布前** 必须完成
```

**建议工时（单人）**：S0 收尾 0.5d · S1 1.5–2d · S2 0.5d · S3 1d · S4 1d · S5 0.5d · 文档/手测 0.5d。

---

## 7. 完成后能否「彻底」

| 范围 | 结论 |
|------|------|
| **T1–T4 手编 + 结构变更** | S0+S1+S2+S3 → **是** |
| **L4/L5 体验误解** | S4 → **是** |
| **L6 异步覆盖** | S5 → **有契约**；需产品选 flush-first 或 block |
| **L7 虚拟列表** | S1 后选中行不依赖 DOM；S0 commit 兜底 → **是** |
| **busy / undo 误操作** | 不在 A 类口径 |

---

## 8. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-11 | 初版：合并诊断 + 业内五步走 + 远期 L1–L7 收口 |

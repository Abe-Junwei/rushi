# Acceptance：语段正文行模型对齐

> **Plan**：[`segment-text-row-model-plan.md`](./segment-text-row-model-plan.md)

---

## 1. 自动化

- [ ] `npm run typecheck`
- [ ] `npm run test`（至少：`useSegmentMutationController.mergeDelete.test.ts` · `useSegmentMutationController.core.test.ts` · `flushSegmentTextDrafts.test.ts` · `segmentConfirmEligible.test.ts` · `segmentDraftStore.test.ts`）
- [ ] `node scripts/check-architecture-guard.mjs`

### 1.1 定向用例（S1 后须存在）

- [ ] 编辑中 merge **不依赖** pre-flush mock 仍保留全文
- [ ] 双端 / 上一段 / unrelated reindex 合并用例（见 mergeDelete.test.ts）
- [ ] split 比例分字（S4）
- [ ] ref 超前 state flush 用例（flushSegmentTextDrafts.test.ts）

---

## 2. 手测 — 合并（M 项）

- [ ] **M1** 选中行改字不 blur → 右键「与下一条合并」→ 含改字
- [ ] **M2** 同上 → `Cmd+M`（波形焦点）→ 含改字
- [ ] **M3** 改 A、切到 B 再改 B → 合并 A|B → 两侧都在
- [ ] **M4** IME 组字中立即合并 → 组字进合并结果
- [ ] **M5**（S3）段首 Backspace → 与上一条合并
- [ ] **M6**（S3）段尾 Delete → 与下一条合并
- [ ] **M7** ≥200 段文件：编辑→滚动→合并相邻 → 不丢字

---

## 3. 手测 — 拆分 / 其它（S4+）

- [ ] **S1** 改字后 playhead 拆分 → 左/右按预期分字（非全文在左）
- [ ] 删除中间语段 → 远处未删语段正文仍在
- [ ] 自动保存 pending 时段落合并 → 合并结果落库后一致

---

## 4. 能力—UI 状态（busy）

| busy | 手编 | 合并 | 预期 |
|------|------|------|------|
| false | ✓ | ✓ | A 类通过 |
| true | ✗ | ✗ | 不丢字（因不可编辑）；不纳入 A 类 |

---

## 5. 签收

- [ ] S0–S5 对应薄片 PR 链接
- [ ] 已知 B 类（转写覆盖）行为已写入 plan §1.3

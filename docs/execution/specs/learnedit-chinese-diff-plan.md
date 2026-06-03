# Plan：中文文本编辑追踪的 diff-anchored 重构

> **关联 research**：[`learnedit-chinese-diff-research.md`](./learnedit-chinese-diff-research.md)
> **关联 intent**：[`learnedit-chinese-diff-intent.md`](./learnedit-chinese-diff-intent.md)
> **关联 acceptance**：[`learnedit-chinese-diff-acceptance.md`](./learnedit-chinese-diff-acceptance.md)

---

## 实施步骤

### Step 1：引入依赖
- `cd apps/desktop && npm install diff-match-patch`
- 安装类型定义：`npm install -D @types/diff-match-patch`（如无内置类型）

### Step 2：grapheme-aware diff wrapper
新建 `apps/desktop/src/services/graphemeDiff.ts`：
- 用 `Intl.Segmenter` 将字符串拆分为 grapheme 数组
- 对 grapheme 数组调用 `diff_match_patch.prototype.diff_main`
- 将 diff 结果（`Diff[]`）映射回原始字符串的 byte/char 偏移
- 导出：`diffGraphemeStrings(a: string, b: string) => Diff[]`

### Step 3：语义边界工具
新建 `apps/desktop/src/services/chineseTextBoundary.ts`：
- `isSemanticBoundaryChar(c: string): boolean` — 标点、常见虚词/助词（的、了、吗、呢、吧、之后、以前、因为、所以、但是、而且、然后、...）
- `findNearestBoundaryBefore(text: string, index: number): number` — 从 index 向左找最近的语义边界
- `findNearestBoundaryAfter(text: string, index: number): number` — 从 index 向右找最近的语义边界

### Step 4：重写 expandLearnOpToReplay
在 `learnEditDelta.ts` 中重写 `expandLearnOpToReplay`：

```typescript
export function expandLearnOpToReplay(
  focusBaseline: string,
  liveText: string,
  op: LearnEditOp,
): LearnEditOp {
  if (focusBaseline === liveText) return op;
  if (applySingleLearnOpToBaseline(focusBaseline, op) === liveText) return op;

  // 1. 窗口截取（anchor ±100 graphemes）
  // 2. 计算 grapheme-aware diff
  // 3. 在 diff 中定位 op.anchor
  // 4. 合并包含锚点的相邻 DELETE + INSERT
  // 5. 语义边界截断
  // 6. 回退到原始 op
}
```

### Step 5：回归测试
- 所有 65 个现有测试必须继续通过
- 新增测试覆盖：
  - `学关→觉观`（suffix 共享场景）
  - 多码点 emoji 替换
  - 跨语义边界替换（应被截断）
  - 窗口边缘的替换

### Step 6：Rust 后端同步
- `services/asr/src/correction.rs` 中查找与前端 `expandLearnOpToReplay` 等价的逻辑
- 评估引入 `similar` crate 或手写简化 Myers diff
- 保持前后端推断结果一致

### Step 7：提交前验证
```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

---

## 文件变更清单

| 文件 | 变更 |
|------|------|
| `apps/desktop/package.json` | 新增 `diff-match-patch` 依赖 |
| `apps/desktop/src/services/graphemeDiff.ts` | 新建：grapheme-aware diff wrapper |
| `apps/desktop/src/services/chineseTextBoundary.ts` | 新建：语义边界检查 |
| `apps/desktop/src/services/learnEditDelta.ts` | 重写 `expandLearnOpToReplay`，保留其余逻辑 |
| `apps/desktop/src/services/learnEditEdgeCases.test.ts` | 新增测试用例 |
| `services/asr/src/correction.rs` | 同步更新 |

## 风险与回退

| 风险 | 缓解 |
|------|------|
| `diff-match-patch` 在超长文本上性能差 | 窗口截取限制为 ±100 graphemes |
| grapheme 映射在多码点字符上错位 | `Intl.Segmenter` 已内置 grapheme 分割 |
| 语义边界列表不完备 | 可逐步扩展；不完备时回退到原始 op 行为 |
| Rust 后端同步延迟 | 前端先合，Rust 单独 PR |

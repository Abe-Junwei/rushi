# Acceptance：中文文本编辑追踪的 diff-anchored 重构

> **关联 research**：[`learnedit-chinese-diff-research.md`](./learnedit-chinese-diff-research.md)
> **关联 intent**：[`learnedit-chinese-diff-intent.md`](./learnedit-chinese-diff-intent.md)
> **关联 plan**：[`learnedit-chinese-diff-plan.md`](./learnedit-chinese-diff-plan.md)

---

## 功能验收

### AC-1：Suffix 共享场景不再过度扩展
```
baseline = "我们学关到了之后，"
live     = "我们觉观到了之后，"
tracked  = {anchor:2, removed:"学", inserted:"觉观"}
expected = {beforeText:"学关", afterText:"觉观"}
```
- [ ] `explicitPairsFromLearnEditState` 返回 `{"学关" → "觉观"}`，而非 `"学关到了之后" → "觉观到了之后"`

### AC-2：前缀共享场景同样正确
```
baseline = "我来到了北京，"
live     = "我来到了上海，"
tracked  = {anchor:3, removed:"北京", inserted:"上海"}
expected = {beforeText:"北京", afterText:"上海"}
```
- [ ] 不吞入前缀或后缀上下文

### AC-3：语义边界截断
```
baseline = "我觉得学关到了之后，"
live     = "我觉得觉观到了之后，"
```
- [ ] 结果应为 `"学关" → "觉观"`，而不是跨越"觉得"和"到了之后"

### AC-4：多码点字符兼容
```
baseline = "hello 👨‍👩‍👧‍👦 world"
live     = "hello 👨‍👩‍👧 world"
```
- [ ] grapheme-aware diff 正确识别为删除一个 family emoji

### AC-5：现有 65 个测试零回归
- [ ] `npm run test -w @rushi/desktop` 全部通过

---

## 能力—UI 状态矩阵

| 能力 | 状态 | UI 反馈 | 测试覆盖 |
|------|------|---------|----------|
| 单字替换（中文） | 正确推断 removed/inserted | 无（后台学习） | `learnEditEdgeCases.test.ts` |
| 多字替换（中文） | 正确推断，不吞上下文 | 无（后台学习） | AC-1, AC-2 |
| 跨语义边界替换 | 在边界处截断 | 无（后台学习） | AC-3 |
| emoji/多码点替换 | grapheme-aware 正确 | 无（后台学习） | AC-4 |
| 英文替换 | 不受影响 | 无（后台学习） | 现有测试 |

---

## 非功能验收

| 项 | 标准 |
|----|------|
| 性能 | diff 窗口 ≤200 graphemes，单次调用 <5ms |
| 依赖 | 仅新增 `diff-match-patch`（~50KB，无 transitive deps） |
| 类型检查 | `npm run typecheck` 零错误 |
| 架构守卫 | `node scripts/check-architecture-guard.mjs` 通过 |

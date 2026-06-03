# Intent：中文文本编辑追踪的 diff-anchored 重构

> **关联 research**：[`learnedit-chinese-diff-research.md`](./learnedit-chinese-diff-research.md)
> **关联 plan**：[`learnedit-chinese-diff-plan.md`](./learnedit-chinese-diff-plan.md)
> **关联 acceptance**：[`learnedit-chinese-diff-acceptance.md`](./learnedit-chinese-diff-acceptance.md)

---

## 目标

将 `learnEditDelta.ts` 中的 `expandLearnOpToReplay` 从"后验可重建性扩展"重构为"diff-anchored 语义推断"，彻底解决中文字符高度复用导致的过度扩展问题。

## 范围

### In
- `expandLearnOpToReplay` 及其调用链的重写
- 引入 `diff-match-patch` npm 包
- grapheme-aware diff wrapper
- 中文语义边界检查（标点、虚词 hard stop）
- 回归测试用例
- Rust 后端 `correction.rs` 同步更新

### Out
- 不删除现有 beforeinput 状态机（`applyBeforeInputToLearnEditState` 等）
- 不引入外部中文分词库（jieba/HanLP）
- 不重构成 OT/CRDT 模型
- 不改 Rust pair 存储格式

## 关键用户价值

用户修改"学关"为"觉观"时，系统不再错误学习"学关到了之后→觉观到了之后"。

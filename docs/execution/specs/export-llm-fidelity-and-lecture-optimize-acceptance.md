# 导出 LLM 保真整理与讲稿优化：Acceptance

> **Research**：[`export-llm-fidelity-and-lecture-optimize-research.md`](./export-llm-fidelity-and-lecture-optimize-research.md)  
> **Plan**：[`export-llm-fidelity-and-lecture-optimize-plan.md`](./export-llm-fidelity-and-lecture-optimize-plan.md)  
> **状态**：待确认

## 1. 能力—UI 状态矩阵

| 交付模式 | LLM 未就绪 | LLM 就绪 | 确认后行为 |
|---|---|---|---|
| 逐字稿 | 可导出，不显示 LLM 阻断 | 同左 | 直接导出 |
| LLM 保真整理 | 阻断并显示当前 Provider 原因 | 可导出 | 自动保真整理后导出 |
| 讲稿优化 | 阻断并显示当前 Provider 原因 | 可生成建议 | 先进预览；只有“确认并导出”进入保存流程 |
| 保真/优化处理中 | 不可重复提交 | 显示正确的能力名和批进度 | 可取消；取消不导出/不写库 |

## 2. 功能验收

- [ ] 旧“大模型润色”文案已改为“LLM 保真整理”，不再声称 LLM 改错字。
- [ ] 导出一级选项只有“逐字稿 / LLM 保真整理 / 讲稿优化”，无重复的普通讲稿选项。
- [ ] 保真整理的 `stripForPunctCompare` 完整性不变量与回退行为未改变。
- [ ] 讲稿优化使用独立任务/协议，非法 ID 批回退，其他批仍可预览。
- [ ] 预览仅列出 `before != after` 的语段，支持逐条勾选、取消和确认导出。
- [ ] 未勾选语段使用原文；勾选语段使用优化候选。
- [ ] 优化流程不调用语段保存/写回命令，导出前后 SQLite 语段一致。
- [ ] Word “接受全部修订”正文等于用户确认的导出行。
- [ ] Word “拒绝全部修订”正文等于导出前原语段。
- [ ] 修订双视图不变量失败时，不导出不可逆改写；降级为原文讲稿并给出明确提示。

## 3. 协议与边界测试

- [ ] 缺失 ID、重复 ID、越界 ID、字段错类型、空 `text`、多余 ID。
- [ ] 长文本分批 offset、单批回退不影响其他批、取消不产生部分 DOCX。
- [ ] 只有标点建议、小改写、大删除/插入、中英文与 XML 特殊字符。
- [ ] 同一自然段中未变行 + 大改行 + 未变行不丢失。
- [ ] 3541 行稀疏和密集改写的 DOCX 双视图回归。

## 4. 手测

- [ ] 真实 2h+ 文稿：保真整理去标点正文覆盖 100%。
- [ ] 真实 2h+ 文稿：讲稿优化预览可取消、部分采纳、全采纳。
- [ ] Word 实际打开：全接受为优化稿，全拒绝为原稿，不存在可见正文缺口。

## 5. 机器守卫

```bash
npm run typecheck
npm run test
cargo test
cargo clippy --all-targets --all-features -- -D warnings
node scripts/check-architecture-guard.mjs
```

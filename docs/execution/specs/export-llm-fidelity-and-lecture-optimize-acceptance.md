# 导出 LLM 保真整理与讲稿优化：Acceptance

> **Research**：[`export-llm-fidelity-and-lecture-optimize-research.md`](./export-llm-fidelity-and-lecture-optimize-research.md)  
> **Plan**：[`export-llm-fidelity-and-lecture-optimize-plan.md`](./export-llm-fidelity-and-lecture-optimize-plan.md)  
> **状态**：自动化验收通过；真实 Word 手测待执行

## 1. 能力—UI 状态矩阵

| 交付模式 | LLM 未就绪 | LLM 就绪 | 确认后行为 |
|---|---|---|---|
| 逐字稿 | 可导出，不显示 LLM 阻断 | 同左 | 直接导出 |
| LLM 保真整理 | 阻断并显示当前 Provider 原因 | 可导出 | 自动保真整理后导出 |
| 讲稿优化 | 阻断并显示当前 Provider 原因 | 可生成修订稿 | 直接生成 Word 修订稿，不进入 Rushi 内预览 |
| 保真/优化处理中 | 不可重复提交 | 显示正确的能力名和批进度 | 可取消；取消不导出/不写库 |

## 2. 功能验收

- [x] 旧“大模型润色”文案已改为“LLM 保真整理”，不再声称 LLM 改错字。
- [x] 导出一级选项只有“逐字稿 / LLM 保真整理 / 讲稿优化”，无重复的普通讲稿选项。
- [x] 保真整理的 `stripForPunctCompare` 完整性不变量与回退行为未改变。
- [x] 讲稿优化使用稳定 uid 的稀疏 `edits`；缺席 uid 保持原文且不算失败。
- [x] 未知/重复/空文本/错类型 edit 只影响该条，不连坐同批正常建议。
- [x] `break_after_uid` 与正文 edits 解耦，空 edits + 空 breaks 合法；批末 uid 断点可跨批保留。
- [x] 讲稿优化不出现 Rushi 内逐语段预览或勾选，完成后直接生成 Word 修订稿。
- [x] 优化流程不调用语段保存/写回命令，导出前后 SQLite 语段一致。
- [x] Word “接受全部修订”正文等于优化导出行（OOXML 自动测试）。
- [x] Word “拒绝全部修订”正文等于导出前原语段（OOXML 自动测试）。
- [x] 接受/拒绝双视图使用 SHA-256 硬校验，输入 uid 去向覆盖率为 100%。
- [x] 每个差异均写为独立 `w:ins` / `w:del` 修订，可由 Word 逐条处理。
- [x] 修订双视图不变量失败时，不导出不可逆改写；降级为原文讲稿并给出明确提示。

## 3. 协议与边界测试

- [x] 稀疏遗漏、未知 uid、重复 uid、字段错类型、空 `text`、旧 items 兼容。
- [x] 长文本分批保持全局 uid；坏 edit 不影响其他 edit；取消不产生部分 DOCX。
- [x] omission 不触发重试；诊断能区分 omission 与 invalid edit。
- [x] 当前 edit 复述前后两条邻段长句时仅回退/重试该 uid；重试结果仍使用原批邻段二次复核。
- [x] 只有标点建议、小改写、大删除/插入、中英文与 XML 特殊字符。
- [x] 同一自然段中未变行 + 大改行 + 未变行不丢失。
- [x] 3541 行稀疏和密集改写的 DOCX 双视图回归。
- [x] 修订作者等于实际模型名，修订时间为 UTC `Z`。

## 4. 手测

- [ ] 真实 2h+ 文稿：保真整理去标点正文覆盖 100%。
- [ ] 真实 2h+ 文稿：讲稿优化可直接导出，不经过应用内预览。
- [ ] Word 实际打开：逐条接受/拒绝有效；全接受为优化稿，全拒绝为原稿，不存在可见正文缺口。

## 5. 机器守卫

```bash
npm run typecheck
npm run test
cargo test
cargo clippy --all-targets --all-features -- -D warnings
node scripts/check-architecture-guard.mjs
```

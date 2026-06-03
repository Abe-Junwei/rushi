# Acceptance: R3t-F — 转写后后处理与编辑效率

> **Plan v3**：[`r3t-f-post-transcribe-suite-plan.md`](./r3t-f-post-transcribe-suite-plan.md)（拍板 D1–D9）  
> **状态**：🟡 进行中 — **F2 首刀已编码**（2026-05-31）；F1/F6/F7 未编码

## 决策追溯（手测前对照 Plan §2）

| ID | 验收时必须满足 |
|----|----------------|
| D1 | F0 默认仅 F1+C |
| D2 | F5 边界 + 默认关 |
| D6–D8 | F7 合并/冲突/小团队导出 |

---

## P1 — F2 查找替换（首刀）

- [x] 工具栏 + `Mod+F`；`busy` 不响应
- [x] 全文件字面匹配；`第 k/N 处`；上/下条跳转语段
- [x] 替换当前 / 全部替换（预览→一次写回）；可撤销
- [x] 搜索前 flush 草稿
- [ ] 手测：长稿改 3 处专名 ≤10 次点击（不含保存）

## P1 — F2 Correct 浮层

- [x] 选中 → memory + glossary 列表（无谐音猜）
- [x] 选中预填查找框（改正 / ⌘F）

## P1 — F2 体验补齐

- [x] 语段正文内高亮当前匹配 + 列表只读行高亮
- [x] Enter / Shift+Enter / ⌘Enter 替换并下一处

## P1 — F1 全文规则

- [x] 仅 memory 规则；全文 diff 预览；确认写回；无 LLM
- [x] 单测：「城市」≠「市」误替换（单字规则跳过）

## P1 — F6 记忆闭环

- [x] 第三次同 right 形 → 保存后提示进 glossary
- [ ] F2 写回 + save → `correction_memory` 增加（手测）
- [ ] R3t-E：Pack 含 rule 时 `evidence: rule` 可校验（既有能力，手测）

---

## P2 — F7 词表包（小团队 · D6–D8）

- [x] 导出 json（zip 仍待做）；默认仅稳定记忆；`optional_label`；无语段（Rust 单测）
- [x] 导入 dry-run：insert/skip/auto/conflict 计数
- [x] hit 高者胜自动合并；平手预览
- [x] 手测 UI：导出 + 导入 ✅（2026-06-03，[`f7-lexicon-bundle-hand-test-checklist.md`](./f7-lexicon-bundle-hand-test-checklist.md)）
- [x] 项目 bundle 不含词表包（`project_bundle_zip_excludes_lexicon_bundle`）

## P2 — F8 导出前检查（候选）

- [ ] 导出向导：条数预览；可剔 hit=1 未采纳
- [ ] 同 before 多条本地 → 清理提示

## P2 — F0-lite（D1）

- [ ] 默认仅勾 F1 + 批处理 C；不勾 E/F5
- [ ] localStorage 记忆用户勾选；C 有进度可取消
- [ ] 段界禁用+说明

## P2 — F4-ASR

- [ ] `asr_llm_review_below`；无分→送审
- [ ] 全稿高置信可跳过 LLM 步骤（若勾选）

---

## P3 — F5（D2）

- [ ] 仅 fluency/logic；无风格/扩写/删段/merge/split
- [ ] confidence 阈值灰显；F0 默认不勾

## P3 — F3

- [ ] 术语推荐 Tab；勾选入库

## Spike — D2

- [ ] 调研笔记 only；无 v1 产品验收

---

## 回归

- [ ] L2 hotwords 与 F1 独立
- [ ] R3t-E 独立入口可用

## 可选竞品对照

- [ ] Sonix Replace All vs F2
- [ ] Descript Correct All vs F2

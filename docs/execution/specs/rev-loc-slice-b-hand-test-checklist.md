# REV-LOC 切片 B — 手测清单（编辑历史恢复）

> **验收真源**：[rev-loc-undo-edit-history-acceptance.md](./rev-loc-undo-edit-history-acceptance.md) § 切片 B  
> **Plan**：[rev-loc-undo-edit-history-plan.md](./rev-loc-undo-edit-history-plan.md) §3

## 前置

```bash
bash scripts/rev-loc-slice-b-hand-test.sh
```

（须 **重编并重启** 桌面端；仅看旧历史行不会出现新 diff。）

## 场景

### 1. 历史恢复（B-2 / B-3）

1. 打开项目与文件，将某语段「胸襟」改为「胸膺」，等待自动保存。  
2. 再改另一句，再保存。  
3. 工具栏「编辑历史」→ 在**第一次保存**条目点「恢复此版本」→ 确认。  
4. 正文应回到第一次保存后状态（含「胸膺」、不含第二句修改）。

### 2. 误操作防护（B-6 / B-7）

1. 升级前无快照的旧记录：无「恢复此版本」按钮。  
2. 转写或保存 busy 时：按钮 disabled。

### 3. 撤销栈（B-5）

1. 恢复完成后 ⌘Z 不应回到恢复前（栈已清空）。  
2. 再改字可正常自动保存与撤销。

## 签收

| 日期 | 范围 | 结果 |
|------|------|------|
| | §1–§3 | |

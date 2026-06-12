# Spec(intent): DELIV-MODE

> **Research**：[`delivery-mode-research.md`](./delivery-mode-research.md)

## 目标

转写后 **定稿向导**：终检 checklist → 打开现有 `DeliveryExportDialog`；A-2 再挂 F1/Stage B 与转写 toast。

## 切片

| 切片 | 范围 |
|------|------|
| **A-1** | 向导壳 + 终检纯函数 + 打开交付导出 |
| **A-2** | 委托规则纠错/Stage B + 转写成功 toast 入口 |

## A-1 验收

- 编辑器可打开「定稿模式」向导
- 终检项基于当前语段（非空、可选元数据提示）
- 通过后打开 `DeliveryExportDialog`（不重复导出逻辑）

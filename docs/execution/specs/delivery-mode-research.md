# 调研：DELIV-MODE（定稿向导）

> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10.4 Step 8–9  
> **状态**：已采纳 · 2026-06-12

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 转写完成后需 **规则纠错 →（可选）改稿 → 终检 → Word 交付**，现入口分散（工具栏、F1、Stage B、交付导出） |
| 本仓现状 | `DeliveryExportDialog` + `exportDeliveryPlan.ts` 已完整；缺 **单一向导壳** 串联终检与导出入口（`ProjectPanel` / `EditorToolbar`） |
| 成功标准 | 无 LLM 可走 **打开向导 → 终检通过 → 交付导出 Word**（H-DELIV-1） |

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 机制 |
|---|------|------|------|
| A | 线性 wizard | Descript Export flow | 分步确认 → 导出 |
| B | Checklist + 深链 | Notion templates | 清单勾选 → 打开已有对话框 |

## 3. 可复用评估

| 路线 | 复用度 | 复用部分 | 冲突 |
|------|--------|----------|------|
| B | **高** | 委托 `DeliveryExportDialog`、`useCorrectionRulesController`、`usePostTranscribeStageBController` | 须保持 F0「预览写回」硬约束 |

**本仓已有**：`DeliveryExportDialog`、`exportPolishDelivery`、`EditorToolbar` 交付导出菜单。

## 4. 决策

| 项 | 结论 |
|----|------|
| 选定 | **A-1**：`DeliveryModeDialog` 壳 + `deliveryModeChecklist` 终检 + 打开 `DeliveryExportDialog`；**A-2** 再委托 F1/Stage B + 转写 toast |
| 不做什么 | 新导出格式；自动写回；替代 `DeliveryExportDialog` 内 LLM 预览 |
| ADR | 对齐 F0-v2 阶段 B 门禁 |

## 5. 落位

| 层 | 路径 |
|----|------|
| 纯函数 | `services/deliveryModeSteps.ts`、`deliveryModeChecklist.ts` |
| Controller | `pages/useDeliveryModeController.ts` |
| UI | `components/DeliveryModeDialog.tsx` |
| 入口 | `EditorToolbar` / `ProjectPanel` |

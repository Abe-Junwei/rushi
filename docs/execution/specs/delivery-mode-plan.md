# Spec(plan): DELIV-MODE A-1

> **Research**：[`delivery-mode-research.md`](./delivery-mode-research.md)

## 改动

1. `services/deliveryModeSteps.ts` — 向导步骤定义
2. `services/deliveryModeChecklist.ts` — 终检纯函数 + 测试
3. `pages/useDeliveryModeController.ts` — 打开/关闭、终检、委托导出对话框
4. `components/DeliveryModeDialog.tsx` — CompactFloatingDialog 壳
5. `ProjectPanel` / `EditorToolbar` — 入口「定稿模式…」

## 验证

`npm run typecheck && npm run test deliveryMode && guard`

# Spec(plan): DELIV-MODE A-2

> **Research**：[`delivery-mode-research.md`](./delivery-mode-research.md)

## 改动

1. `services/deliveryModeSteps.ts` — 可选步骤 rules / stage_b
2. `services/deliveryModeTranscribeToast.ts` — 转写成功 toast「定稿模式…」
3. `components/DeliveryModeDialog.tsx` — 委托 F1 / Stage B 入口
4. `ProjectPanelDialogs` — 接线 `requestPostTranscribeProcessing` / `openPostTranscribeStageB`

## 验证

`npm run typecheck && npm run test deliveryMode && guard`

# Spec(plan): FLOAT-FIT

> **Intent**：[`floating-dialog-fit-unification-intent.md`](./floating-dialog-fit-unification-intent.md)  
> **Acceptance**：[`floating-dialog-fit-unification-acceptance.md`](./floating-dialog-fit-unification-acceptance.md)  
> ⚠️ **最终实现路线（已落地）**：CSS 自动高度单一真源 — `.cursor/plans/float-fit-css-auto-height`（F-A…F-E）。下文 F-0…基于 boolean 映射的步骤为历史方案；实际以 css-auto-height 计划与架构文档为准。

---

## F-0 基础设施

### 1. 类型与 API

**落位**：`apps/desktop/src/components/floatingPanelFitKind.ts`（或并入 `floatingPanelFitSections.ts`）

```typescript
export type PanelFitKind = "autoFit" | "fill" | "staticFit";
```

**扩展 `CompactFloatingDialog`**（首选，不新建平行壳）：

| Prop | 说明 |
|------|------|
| `fitKind: PanelFitKind` | 替代裸 `fillHeight` 为唯一真源；内部映射 `fillHeight` / 默认 `ListRegion` 行为 |
| `fitSections?: FloatingPanelFitSection[]` | 可选；替代散落 `STATIC_BODY_PX` |
| `minHeight` | Auto-fit：**默认** `Math.min(contentFitHeight, maxHeight)`，非固定 300 |
| `editorOverlay?: boolean` | `true` → findReplace bounds + `panelZIndex` 默认 110 + 可选 workbench anchor |

**映射表（实现真源）**：

| `fitKind` | `FloatingPanelDialogRoot.fillHeight` | `ListRegion.fillAvailable` 默认 | `resolveCompactFloatingContentFitHeight.fillHeight` |
|-----------|--------------------------------------|----------------------------------|-----------------------------------------------------|
| `autoFit` | `false` | `false` | `false` |
| `fill` | `true` | `true` | `true` |
| `staticFit` | `false` | N/A | `false` |

### 2. Section 估算

- 推广 `resolveFloatingPanelSectionsFitHeight(sections)` 为对话框 `estimatedFitHeight` 首选
- 每对话框保留 `*PanelLayout.ts`：`resolveXxxLayoutRev` + `resolveXxxFitSections`（查找替换已有 [`findReplacePanelLayout.ts`](../../../apps/desktop/src/components/findReplacePanelLayout.ts) 雏形）
- 校准常量：与 DOM 手测一次，单测断言 0/2/8/20 行单调性

### 3. Persist / sync

- 所有多阶段对话框：`persistPhaseKey` + `layoutRev`（含行数、展开态、phase）
- **R2**：`layoutRev` 变化 → `resolvePhasePersistedSize` 返回 `null` → `userSizedRef=false` → viewport sync 重算（已部分存在于 [`useDraggablePanelViewportSync.ts`](../../../apps/desktop/src/hooks/useDraggablePanelViewportSync.ts)）
- Auto-fit 对话框：`minHeight` 随 `contentFitHeight` 传递，避免固定 300 挡收缩

### 4. 布局组件默认值

- [`FloatingPanelDialogListRegion`](../../../apps/desktop/src/components/FloatingPanelDialogLayout.tsx)：**默认 `fillAvailable=false`**；仅 `fitKind=fill` 时 true
- 文档 [`desktop-floating-dialog-panels.md`](../../architecture/desktop-floating-dialog-panels.md)：替换 §「默认 fillAvailable」为 **PanelFitKind 决策表**（链本 spec）

### 5. Architecture guard

**落位**：[`scripts/check-architecture-guard.mjs`](../../../scripts/check-architecture-guard.mjs)

- 禁止业务层 `FloatingPanelTemplate` + `preset="compactDialog"`（已有）
- **新增**：禁止业务层 `FloatingPanelTemplate` + `preset="findReplace"`，allowlist：
  - `CompactFloatingDialog.tsx`
  - `PanelTemplate.tsx`
  - `ProjectPanel.tsx`（environment）
  - `*PanelLayout.test.ts`（若需）

---

## F-1 迁移 Auto-fit

| 文件 | 改动 |
|------|------|
| [`FindReplaceDialog.tsx`](../../../apps/desktop/src/components/FindReplaceDialog.tsx) | 迁入 `CompactFloatingDialog`（或扩展壳）；`fitKind="autoFit"`；保留 `findReplacePanelLayout` |
| [`FindReplaceDialogBody.tsx`](../../../apps/desktop/src/components/FindReplaceDialogBody.tsx) | 列表 intrinsic；footer 可拆至 `CompactFloatingDialog.footer` |
| [`CorrectionRulesPreviewDialog.tsx`](../../../apps/desktop/src/components/CorrectionRulesPreviewDialog.tsx) | preview/empty 分 phase；preview `autoFit`；loading `staticFit`；workbench anchor 保留 |
| [`correctionRulesPreviewLoader.ts`](../../../apps/desktop/src/pages/correctionRulesPreviewLoader.ts) | 改为 sections API |
| [`PostTranscribeStageBDialog.tsx`](../../../apps/desktop/src/components/PostTranscribeStageBDialog.tsx) | preview phase `fitKind="autoFit"`；consent/loading/empty `staticFit` 或 `fill` 按现有估算 |

---

## F-2 迁移 Fill

| 文件 | 改动 |
|------|------|
| [`DeliveryExportDialog.tsx`](../../../apps/desktop/src/components/DeliveryExportDialog.tsx) | 迁入 `CompactFloatingDialog`；`fitKind="fill"`；保留 `deliveryExportLayoutRev` |
| [`GlossaryLearnPromptDialog.tsx`](../../../apps/desktop/src/components/GlossaryLearnPromptDialog.tsx) | `fitKind="fill"`；列表改 `FloatingPanelSegmentList` + 区内 `max-h` 或 fill region |
| [`BatchTranscribeQueueDialog.tsx`](../../../apps/desktop/src/components/BatchTranscribeQueueDialog.tsx) | 显式 `fitKind="fill"` |
| [`AutoTranscribeStartDialog.tsx`](../../../apps/desktop/src/components/AutoTranscribeStartDialog.tsx) | 显式 `fitKind="fill"` |
| Lexicon import/export | 显式 `fitKind="fill"` |

---

## F-3 扫尾

- 所有 `CompactFloatingDialog` 调用点声明 `fitKind`（无默认值强迫显式选择）
- 单测：各 `*PanelLayout.test.ts` + `floatingPanelFitSections` merge 边界
- L3：[`release-parity-l3-hand-test-checklist-2026-06-14.md`](../release-parity-l3-hand-test-checklist-2026-06-14.md) 增 **FLOAT-FIT** 小节（或链 acceptance）

---

## 验证命令

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
```

定向：

```bash
cd apps/desktop && npx vitest run \
  src/components/findReplacePanelLayout.test.ts \
  src/components/floatingPanelFitSections.test.ts \
  src/components/floatingPanelSegmentListLayout.test.ts
```

---

## 风险

| 风险 | 缓解 |
|------|------|
| Auto-fit 首帧测高为 0 | `estimatedFitHeight` 下限 + `useFrozenPanelBodyHeight` |
| 用户依赖旧 persist 高度 | R2 仅 layoutRev 变时重置；不 bump 全局 rev（v1 不做 #3） |
| Fill 对话框误标 autoFit | acceptance 分 kind 手测 + guard 强制显式 `fitKind` |

---

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-19 | 初版 |

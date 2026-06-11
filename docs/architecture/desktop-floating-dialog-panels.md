# 桌面端浮动对话框面板（Notion / Zen）

## 约定

新增或改动的**可拖动浮动对话框**统一走 **Notion / Zen** 视觉；**短确认 / 标准 compact 框**须用 **`CompactFloatingDialog`**（或 **`CompactConfirmDialog`**），禁止业务层直接 `FloatingPanelTemplate` + `preset="compactDialog"`（机器守卫 **error**）。

| 项 | 真源 |
|----|------|
| 面板壳 / 标题栏 | `DraggableResizablePanel`（固定 Notion 样式；正文区 `.floating-panel-body-scroll` 溢出时右侧滚动条） |
| 预设尺寸 | `PanelTemplate.tsx` → `compactDialog`（小确认框）/ `findReplace`（查找替换，z≥110） |
| 页脚按钮 | `apps/desktop/src/config/controlStyles.ts`（`CONTROL_BTN_SECONDARY` + `CONTROL_BTN_PRIMARY` / `CONTROL_BTN_DANGER`，同 h-8） |
| 颜色 token | `tailwind.config.js` + `apps/desktop/src/config/tokens.ts`（`notion-*`、`zen-*`） |

## 尺寸记忆（persist v3）

`DraggableResizablePanel` 通过 `localStorage` 键 `panel-state-{id}` 记忆位置与尺寸。

| 字段 | 含义 |
|------|------|
| `position` / `size` | 最近一次关闭时的全局位置与尺寸 |
| `userSized` | 用户是否手动拖改过尺寸；`false` 时随 `contentFitHeight` 自动增高 |
| `layoutRev` | 布局算法版本（当前 `3`）；变更后旧记忆作废 |
| `phases[phaseKey]` | 各阶段独立 `size` + `userSized`（位置仍共享） |

### compactDialog 尺寸陷阱（已统一修复）

旧版 `compactDialog` 预设曾硬编码 **`maxHeight: 200` / `maxWidth: 320`**。许多对话框只覆写 `minHeight`（260–320）或 `maxWidth`，未覆写 `maxHeight`，导致：

1. **面板被压到 200px**，正文区出现无意义滚动条、文案裁切  
2. **`minHeight > maxHeight`**，东/南缩放手柄失效，无法手动拉高  
3. **`contentFitHeight` 被 cap 在 200**，自动适应失效  

**统一约定：**

- 预设已改为 `maxWidth: 560`、`maxHeight: 720`（仍受视口 clamp）  
- `FloatingPanelTemplate` 在 `min* > max*` 时自动抬升上限  
- 内容随动的对话框传 `contentFitHeight` + `resolveCompactDialogBounds()`（见 `floatingPanelCompactDialogBounds.ts`）  
- 短文案对话框用 `FloatingPanelDialogHeader` + `Footer`，**不要**把短说明塞进 `FloatingPanelDialogScroll`（`flex-1` 会误导测量）  
- 危险确认与取消须同高：用 `CONTROL_BTN_DANGER`（h-8），**勿**与 `CONTROL_BTN_SECONDARY` 混用 `CONTROL_BTN_DANGER_COMPACT`（h-7）  
- 范例：`ClearAsrCacheConfirmDialog`、`RestoreEditLogConfirmDialog`、`AutoTranscribeStartDialog`  
- `mergeContentFitHeights`：实测 **更矮** 时缩面板；实测 **更高** 时防裁切  
- 双击标题栏恢复自动高度；`layoutRev`  bump 后丢弃旧 200px 记忆  

用法：

- 对话框传 `contentFitHeight`（估算 + `ResizeObserver` 测量取 `max`，见 `floatingPanelFitSections.mergeContentFitHeights`）。
- 多阶段对话框传 `persistPhaseKey`（如 `empty` / `preview` / `loading`）。
- 传 `maxWidth` 限制东/西向缩放与 clamp（`FloatingPanelTemplate` 透传）。
- **双击标题栏**恢复自动高度（清除 `userSized` 并按当前 `contentFitHeight` 重算）。

相关模块：

- `apps/desktop/src/components/floatingPanelCompactDialogBounds.ts`
- `apps/desktop/src/components/floatingPanelPersist.ts`
- `apps/desktop/src/components/floatingPanelFitSections.ts`
- `apps/desktop/src/hooks/useFloatingPanelBodyMeasure.ts`
- `apps/desktop/src/hooks/useFloatingPanelDetailsExpansion.ts`（`<details>` 展开影响估算高度）

## 正文分区（ListRegion + fillAvailable）

语段列表类对话框优先：

```tsx
<FloatingPanelDialogRoot measureRef={bodyRef}>
  <FloatingPanelDialogHeader>…固定说明…</FloatingPanelDialogHeader>
  <FloatingPanelDialogListRegion>
    <FloatingPanelSegmentList rowCount={n} fillAvailable>…</FloatingPanelSegmentList>
  </FloatingPanelDialogListRegion>
  <FloatingPanelDialogFooter>…</FloatingPanelDialogFooter>
</FloatingPanelDialogRoot>
```

缩放面板时仅列表区滚动，页脚按钮保持可见。

## 默认尺寸陷阱

`FloatingPanelTemplate` 在未传 `defaultSize` 时，会把预设的 **`maxWidth` / `maxHeight` 当作首次打开的宽高**（见 `resolvePanelTemplateMetrics`）。例如 `createProject` 的 `maxHeight: 560` 会让内容区下方出现大块空白——与表单 `margin` 无关，而是**面板壳被撑高**。新对话框应显式传 `defaultSize`（可参考 `CreateProjectModal`、`ClearAsrCacheConfirmDialog`）。

## 落位模板（短确认框）

```tsx
<CompactConfirmDialog
  id="my-dialog-v1"
  title="…"
  open={open}
  onCancel={onCancel}
  onConfirm={onConfirm}
  confirmLabel="确认"
  confirmVariant="primary" // 或 "danger"
  fallbackHeight={240}
  defaultWidth={360}
  bounds={{ minWidth: 280, minHeight: 200 }}
  persistState
>
  <p className={PANEL_TYPOGRAPHY.dialogBody}>说明文案</p>
</CompactConfirmDialog>
```

多区块 / 列表 / 自定义页脚 → **`CompactFloatingDialog`**（内置 `contentFitHeight` + portal + `workspace` 包装）：

```tsx
<CompactFloatingDialog
  id="my-dialog-v1"
  title="…"
  open={open}
  onClose={onClose}
  fallbackHeight={280}
  estimatedFitHeight={optionalSectionEstimate}
  footer={<>…</>}
>
  <FloatingPanelDialogHeader>…</FloatingPanelDialogHeader>
  <FloatingPanelDialogListRegion>…</FloatingPanelDialogListRegion>
</CompactFloatingDialog>
```

- `check-architecture-guard.mjs`：业务文件出现 `preset="compactDialog"` 且非 `CompactFloatingDialog.tsx` → **error**。

## 异步 / 进度态

浮动对话框内的 loading 统一用 `PanelAsyncProgress`（`apps/desktop/src/components/PanelAsyncProgress.tsx`）：

| `mode` | 适用场景 | 表现 |
|--------|----------|------|
| `spinner` | 短任务、无确定步数（规则纠错加载、改正匹配） | 居中 `LoaderCircle` + 一行 `dialogBody` |
| `determinate` | 多步 LLM（智能改稿） | 单行 `provider · 步骤详情` + `panelProgressStyles` 进度条 + 可选取消 |

进度条 token 真源：`apps/desktop/src/components/panelProgressStyles.ts`（对话框 `h-2`、环境页内嵌 `h-1.5` 共用 `bg-notion-sidebar` 轨道与 `zen-saffron-mid` 填充）。

全屏阻塞等待（保存/导出/转写等）用 `BlockingProgressCard`：`rounded-lg` 卡片 + 不确定进度条 + `已等待 Ns`；转写预览用 `variant="banner"`（不挡编辑，可停止转写）。

## 参考实现

- `apps/desktop/src/components/CompactFloatingDialog.tsx`（成品壳）
- `apps/desktop/src/components/CompactConfirmDialog.tsx`（短确认）
- `apps/desktop/src/components/ClearAsrCacheConfirmDialog.tsx`（危险确认）
- `apps/desktop/src/components/AutoTranscribeStartDialog.tsx`（多区块 + 页脚）
- `apps/desktop/src/components/PostTranscribeStageBDialog.tsx`（多阶段 + 列表）
- `apps/desktop/src/components/CorrectionRulesPreviewDialog.tsx`（`findReplace` + `spinner`）

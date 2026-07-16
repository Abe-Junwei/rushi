# 桌面端浮动对话框面板（Notion / Zen）

> **高度真源（FLOAT-FIT，已落地）**：[`floating-dialog-fit-unification-intent.md`](../execution/specs/floating-dialog-fit-unification-intent.md)（`PanelFitKind`：Auto-fit / Fill / Static-fit → CSS 自动高度单一真源）  
> **词汇**：[`CONTEXT.md`](../../CONTEXT.md) §浮动对话框

## 约定

新增或改动的**可拖动浮动对话框**统一走 **Notion / Zen** 视觉；**短确认 / 标准 compact 框**须用 **`CompactFloatingDialog`**（或 **`CompactConfirmDialog`**），禁止业务层直接 `FloatingPanelTemplate` + `preset="compactDialog"`（机器守卫 **error**）。

| 项 | 真源 |
|----|------|
| 面板壳 / 标题栏 | `DraggableResizablePanel`（固定 Notion 样式；正文区 `.floating-panel-body-scroll` 溢出时右侧滚动条） |
| 预设尺寸 | `PanelTemplate.tsx` → `compactDialog`（小确认框）/ `findReplace`（查找替换，z≥110） |
| 页脚按钮 | `apps/desktop/src/config/controlStyles.ts`（`CONTROL_BTN_SECONDARY` + `CONTROL_BTN_PRIMARY` / `CONTROL_BTN_DANGER`，同 h-8） |
| 颜色 token | `tailwind.config.js` + `apps/desktop/src/config/tokens.ts`（`notion-*`、`zen-*`） |

## 高度真源：CSS 自动高度（单一真源）

浮层高度**只有一个真源 = 浏览器布局**，JS 不再估算/实测内容高度。`fitKind` 仅映射到高度模式：

| `fitKind` | 高度模式 | 壳层 CSS |
|-----------|----------|----------|
| `autoFit` / `staticFit` | `auto`（未手拖时） | `height: auto` + `max-height = min(maxHeight, 视口封顶)`，超出时正文区内滚；首帧即正确，无估算、无闪跳 |
| `fill` | `manual` | 固定 px 高度（默认 `fallbackHeight`），正文区 `flex-1` 填充并内滚 |
| 任意（用户拖过尺寸后） | `manual` | 固定 px 高度（`userSized=true`） |

- **居中**：auto 模式用 `transform: translate(-50%, -50%)`（高度未知也能居中）；用户拖动后切 px 定位（`DraggableResizablePanel` 拖拽起手读 `offsetHeight` 落 px 基线）。
- **单一可滚动正文区**：壳内为 `Header(shrink-0) + ScrollRegion(flex-1 min-h-0 overflow-y-auto) + Footer(shrink-0)` 兄弟结构。短内容整壳贴合，长内容仅 ScrollRegion 内滚、页脚常驻。
- **双击标题栏**：清 `userSized` 回到 auto 高度并重新居中。

真源代码：

| 关注点 | 真源 |
|--------|------|
| 高度/居中布局规则（纯函数） | `draggablePanelGeometry.ts`（`resolvePanelLayout` / `resolvePanelMaxHeightCap`） |
| 单一状态机（heightMode / centered / position / size） | `hooks/useDraggablePanelController.ts` |
| 视口 reconcile（仅 cap/clamp/居中） | `hooks/useDraggablePanelViewportSync.ts` |
| 高度模式映射 | `floatingPanelFitKind.ts`（`resolvePanelAutoHeight`） |

> 已退役（机器守卫禁止重新引入）：`resolveCompactFloatingContentFitHeight`、`useFloatingPanelBodyMeasure`、`useFrozenPanelBodyHeight`、`floatingPanelFitSections`、`resolveContentFitTargetHeight`、`estimatedFitHeight` prop、按行数计算的 `*FitHeight` / `layoutRev`。

## 尺寸记忆（persist v4）

`DraggableResizablePanel` 通过 `localStorage` 键 `panel-state-{id}` 记忆位置与（手拖后的）尺寸。

| 字段 | 含义 |
|------|------|
| `position` / `size` | 最近一次关闭时的位置与尺寸（auto 未手拖时 `size` 仅占位，载入时被忽略） |
| `userSized` | 用户是否手动拖改过尺寸；`false` → 高度模式回到 `auto` |
| `layoutRev` | 布局版本（当前 `FLOATING_PANEL_LAYOUT_REV = 4`）；变更后旧记忆作废 |
| `phases[phaseKey]` | 各阶段独立 `size` + `userSized`（位置共享） |

用法：

- `fitKind` 必填（`autoFit` / `fill` / `staticFit`，机器守卫 error）；`fallbackHeight` 为打开时占位/默认高度。
- 多阶段对话框传 `persistPhaseKey`（如 `empty` / `preview` / `loading`）以分别记住手拖尺寸。
- 传 `maxWidth` / `maxHeight` 限制缩放与 clamp（`FloatingPanelTemplate` 透传）。
- **`CompactFloatingDialog`** 未传 `persistState` 时继承 preset 默认（`compactDialog` / `findReplace` → `true`）；显式 `persistState={false}` 可关闭（如 OTA 确认）。
- **`environment` preset**（设置大面板）默认 `persistState: true`，位置与手拖尺寸写入 `panel-state-environment-v3`。
- **默认/边界尺寸**随 [`uiDisplayScale`](../../apps/desktop/src/services/ui/uiDisplayScale.ts) 的 `scaleUiPanelPx` 同比放大（100% 为基准）；用户已持久化的手拖尺寸不二次缩放。

## 拖拽改大小（边 / 角）

所有 `DraggableResizablePanel` 壳层（含设置、查找替换、导出等）均带 **8 向 resize hit zone**：

| 区域 | 行为 |
|------|------|
| 四边（n/s/e/w） | 单轴改宽或改高 |
| 四角（nw/ne/sw/se） | 同时改宽与高 |
| 标题栏 | 移动位置；Auto-fit 框双击恢复自动高度 |

- **真源**：`DraggablePanelResizeHandles.tsx` + `hooks/draggablePanelDragResize.ts` + `useDraggablePanelPointerDrag.ts`
- **可见 affordance**：无（透明 hit zone；光标变为 `*-resize` 即表示可拖）
- **标题栏提示**：`dialogPanelTitleBarHint()` — 移动 / 拖边或角 /（Auto-fit）双击恢复

## 正文分区（单滚动区）

语段列表/长表单类对话框：把固定内容放 `FloatingPanelDialogHeader`（`shrink-0`），把需滚动内容放 `FloatingPanelDialogScroll` 或 `FloatingPanelDialogListRegion`（`flex-1 min-h-0 overflow-y-auto`），二者皆为壳内 flex 列**直接子节点**。`FloatingPanelSegmentList` 为 intrinsic 行高、不自带 overflow（滚动交给单一正文区，修复换行行被压裁）。

**Auto-fit 示例**（查找替换、规则纠错 preview）：

```tsx
<CompactFloatingDialog fitKind="autoFit" shellPreset="findReplace" …>
  <FloatingPanelDialogHeader>…</FloatingPanelDialogHeader>
  <FloatingPanelDialogListRegion>
    <FloatingPanelSegmentList rowCount={n}>…</FloatingPanelSegmentList>
  </FloatingPanelDialogListRegion>
</CompactFloatingDialog>
```

**Fill 示例**（交付导出、长表单）：`fitKind="fill"` + `FloatingPanelDialogScroll`。

缩放面板时仅列表/滚动区滚动，页脚按钮保持可见。

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

多区块 / 列表 / 自定义页脚 → **`CompactFloatingDialog`**（CSS 自动高度 + portal + `workspace` 包装）：

```tsx
<CompactFloatingDialog
  id="my-dialog-v1"
  title="…"
  open={open}
  onClose={onClose}
  fitKind="autoFit"
  fallbackHeight={280}
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

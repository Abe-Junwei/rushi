# 桌面端浮动对话框面板（Notion / Zen）

## 约定

新增或改动的**可拖动浮动对话框**（`FloatingPanelTemplate` + `preset="compactDialog"`）统一走 **Notion / Zen** 视觉，禁止再使用已废弃的 `serene` 面板变体（衬线标题、`rounded-2xl` 等）。

| 项 | 真源 |
|----|------|
| 面板壳 / 标题栏 | `DraggableResizablePanel`（固定 Notion 样式；正文区 `.floating-panel-body-scroll` 溢出时右侧滚动条） |
| 预设尺寸 | `PanelTemplate.tsx` → `compactDialog`（小确认框）/ `findReplace`（查找替换，z≥110） |
| 页脚按钮 | `apps/desktop/src/config/controlStyles.ts`（`CONTROL_BTN_SECONDARY` / `CONTROL_BTN_DANGER_COMPACT` 等） |
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

## 落位模板

```tsx
<FloatingPanelTemplate
  id="my-dialog-v1"
  title="…"
  preset="compactDialog"
  defaultSize={{ width: 300, height: 292 }}
  minWidth={280}
  minHeight={268}
  persistState
  onClose={onClose}
>
  <div className="flex flex-col px-5 py-3">…</div>
</FloatingPanelTemplate>
```

- 需 `createPortal(..., document.body)` 时，外层包一层 `<div className="workspace">`，避免 WebKit 给 `<button>` 叠默认内阴影。
- 正文：`text-sm text-zen-stone` / `text-notion-text-muted`；说明块：`bg-notion-callout-bg` + `border-notion-divider`。
- 不要用 `mt-auto` + `h-full` 把按钮顶到面板底部，除非刻意做大面板；优先按文案设 `defaultSize` / `minHeight`。

## 异步 / 进度态

浮动对话框内的 loading 统一用 `PanelAsyncProgress`（`apps/desktop/src/components/PanelAsyncProgress.tsx`）：

| `mode` | 适用场景 | 表现 |
|--------|----------|------|
| `spinner` | 短任务、无确定步数（规则纠错加载、改正匹配） | 居中 `LoaderCircle` + 一行 `dialogBody` |
| `determinate` | 多步 LLM（智能改稿） | 单行 `provider · 步骤详情` + `panelProgressStyles` 进度条 + 可选取消 |

进度条 token 真源：`apps/desktop/src/components/panelProgressStyles.ts`（对话框 `h-2`、环境页内嵌 `h-1.5` 共用 `bg-notion-sidebar` 轨道与 `zen-saffron-mid` 填充）。

全屏阻塞等待（保存/导出/转写等）用 `BlockingProgressCard`：`rounded-lg` 卡片 + 不确定进度条 + `已等待 Ns`；转写预览用 `variant="banner"`（不挡编辑，可停止转写）。

## 参考实现

- `apps/desktop/src/components/FileDialogs.tsx`（删除 / 新建文件）
- `apps/desktop/src/components/ClearAsrCacheConfirmDialog.tsx`（清除模型缓存）
- `apps/desktop/src/components/PostTranscribeStageBDialog.tsx`（`determinate`）
- `apps/desktop/src/components/CorrectionRulesPreviewDialog.tsx`（`spinner`）

# 桌面端浮动对话框面板（Notion / Zen）

## 约定

新增或改动的**可拖动浮动对话框**（`FloatingPanelTemplate` + `preset="compactDialog"`）统一走 **Notion / Zen** 视觉，禁止再使用已废弃的 `serene` 面板变体（衬线标题、`rounded-2xl` 等）。

| 项 | 真源 |
|----|------|
| 面板壳 / 标题栏 | `DraggableResizablePanel`（固定 Notion 样式） |
| 预设尺寸 | `PanelTemplate.tsx` → `PANEL_TEMPLATE_PRESETS.compactDialog` |
| 页脚按钮 | `apps/desktop/src/config/controlStyles.ts`（`CONTROL_BTN_SECONDARY` / `CONTROL_BTN_DANGER_COMPACT` 等） |
| 颜色 token | `tailwind.config.js` + `apps/desktop/src/config/tokens.ts`（`notion-*`、`zen-*`） |

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

## 参考实现

- `apps/desktop/src/components/FileDialogs.tsx`（删除 / 新建文件）
- `apps/desktop/src/components/ClearAsrCacheConfirmDialog.tsx`（清除模型缓存）

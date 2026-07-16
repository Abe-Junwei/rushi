# Spec(acceptance): FLOAT-FIT

> **Intent**：[`floating-dialog-fit-unification-intent.md`](./floating-dialog-fit-unification-intent.md)  
> **Plan**：[`floating-dialog-fit-unification-plan.md`](./floating-dialog-fit-unification-plan.md)  
> **最终实现路线（已落地）**：CSS 自动高度单一真源 — 见 `.cursor/plans/float-fit-css-auto-height`。`fitKind` 仅映射高度模式（autoFit/staticFit → `auto`；fill → `manual`）；估算/实测/merge/bounds 四方混算与 `contentFitHeight` / `estimatedFitHeight` / 行数 `layoutRev` 全部退役。

---

## 机器门禁

- [x] `PanelFitKind` 类型与 `CompactFloatingDialog.fitKind` 已落地（必填）
- [x] 估算/实测机器退役：`floatingPanelFitSections` / `useFloatingPanelBodyMeasure` / `useFrozenPanelBodyHeight` / `*FitHeight` / 行数 `layoutRev` 已删
- [x] `check-architecture-guard.mjs` 禁止业务层 `preset="findReplace"` bypass（allowlist 正确）
- [x] `check-architecture-guard.mjs` 要求业务层 `CompactFloatingDialog` 显式 `fitKind`
- [x] `check-architecture-guard.mjs` 禁止重新引入退役估算 API（`contentFitHeight`/`estimatedFitHeight`/`useFloatingPanelBodyMeasure`…）
- [x] `draggablePanelGeometry`（`resolvePanelLayout`/`resolvePanelMaxHeightCap`）纯函数单测通过
- [x] `npm run typecheck` 通过
- [x] `npm run test` 全量通过
- [x] `npm run lint` 通过
- [x] `node scripts/check-architecture-guard.mjs` 无新增 error
- [x] [`desktop-floating-dialog-panels.md`](../../architecture/desktop-floating-dialog-panels.md) 已重写为「CSS 自动高度单一真源」并链本 spec

---

## F-0 基础设施

- [x] 业务对话框仅通过 `CompactFloatingDialog` / `CompactConfirmDialog` 使用 `FloatingPanelTemplate`（compact + findReplace）
- [x] `fitKind` 映射高度模式（auto/manual），单一状态机在 `useDraggablePanelController`
- [x] Auto-fit 对话框壳高由 CSS 自动高度决定，无固定 300/400 floor

---

## F-1 Auto-fit 对话框

### 查找替换（`FindReplaceDialog`）

- [x] 已迁入统一壳；`fitKind=autoFit`；查找输入为 Header(shrink-0)、结果列表为单一滚动区(flex-1)
- [ ] 0 匹配 / 未查找：壳层紧凑，无 footer 下大块空白
- [ ] 2 匹配：列表区贴内容高度，无框内大块空白
- [ ] 8+ 匹配：壳层封顶后仅结果区内滚，查找输入与底栏常驻
- [ ] 全部替换预览：同 auto-fit；底栏「返回 / 确认」完整可见
- [ ] 匹配数 2→8→0：壳高随 CSS 自动跟随；手动拖高后搜索不被吞（`userSized` 保留）

### 规则纠错 preview

- [x] preview phase `autoFit`；代码已迁移
- [ ] 手测：列表可见；底栏不裁切
- [x] empty/loading `staticFit`

### 智能改稿 preview

- [x] preview phase `autoFit`（代码）
- [ ] 手测：32 条时列表区可见；底栏完整
- [x] consent/loading/empty `staticFit`

---

## F-2 Fill 对话框

### 交付导出 Word

- [x] `fitKind=fill`（代码）
- [ ] 手测：长表单区内滚；底栏导出按钮始终可见

### 术语表学习提示 / Lexicon 导入导出

- [x] `fitKind=fill`（代码）
- [ ] 手测：少行时壳高不明显随 row 增高；列表区内滚

### 批量转写 / 自动转写启动 / 定稿向导

- [x] 显式 `fitKind=fill`（代码）

---

## F-3 Static-fit

- [x] 全业务 `CompactFloatingDialog` 调用点已显式 `fitKind`（含 CompactConfirm → staticFit）
- [ ] 手测：创建项目 / ClearAsrCache 等无回归

---

## 能力—UI 状态矩阵

本薄片 **不涉及** D1–D6 ASR 能力维度；下列为 **布局—UI 对齐**（非 Close Gate / 非 Provider 状态）：

| UI 区域 | 应对齐维度 | 真源 | 手测 |
|---------|------------|------|------|
| Auto-fit 壳高 | `PanelFitKind.autoFit/staticFit` → `heightMode:"auto"`（CSS `height:auto`+`max-height`） | `resolvePanelLayout` / `resolvePanelMaxHeightCap` | L3 **I1–I3、I5** |
| Fill 壳高 | `PanelFitKind.fill` → `heightMode:"manual"`（px + 正文区 flex-1 内滚） | `useDraggablePanelController` | L3 **I4** |
| Restore auto height | `userSized=false` → `heightMode:"auto"` + 居中 | 标题栏双击 | L3 **I5** |
| Resize affordance | 8 向透明 hit zone（无可见边线） | `DraggablePanelResizeHandles` / `panels.css` | 光标变 `*-resize`；拖角/边改大小；设置面板关闭再开尺寸保持 |

---

## 手测 H-FLOAT-RESIZE（壳层补充）

1. [ ] 打开 **设置**：移到面板边缘光标变 resize；拖右下角放大；关闭再开尺寸保持
2. [ ] **查找替换**（Auto-fit）：拖底边增高后列表区内滚；双击标题栏恢复紧凑高度
3. [ ] **交付导出**（Fill）：拖宽后表单区仍内滚，页脚按钮完整可见

---

## 手测 H-FLOAT-FIT

→ 已并入 [release-parity-l3-hand-test-checklist-2026-06-14.md](../release-parity-l3-hand-test-checklist-2026-06-14.md) **§I**

**记录**

| 日期 | 执行人 | 结果 | 备注 |
|------|--------|------|------|
| | | | |

---

## v1 不做核对

- [x] environment 设置壳已启用 `persistState`（位置 + 手拖尺寸记忆）
- [x] 未改 inline 查找条
- [x] 未动 EditorSegmentList 虚拟化
- [x] 未加 Storybook
- [~] `FLOATING_PANEL_LAYOUT_REV` 3 → 4（用户同意重置旧 persist 尺寸）

---

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-19 | 初版 |
| 2026-06-19 | F-0–F-3 代码落地；L3 §I 手测条目 |
| 2026-06-19 | 最终路线改为 CSS 自动高度单一真源；退役估算/实测机器；bump REV→4；新增 geometry 纯函数测试与守卫 |

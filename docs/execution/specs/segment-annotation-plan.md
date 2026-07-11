# Plan：语段标注（A1–A5）

> **Research**：[`segment-annotation-research.md`](./segment-annotation-research.md)  
> **Intent**：[`segment-annotation-intent.md`](./segment-annotation-intent.md)

## 1. 数据模型

| 项 | 值 |
|----|-----|
| SQLite 列 | `segments.annotation TEXT NOT NULL DEFAULT ''` |
| DTO | `SegmentDto.annotation: Option<String>`（空串 / 仅空白 → `None`） |
| 真源 | 与 `text` 相同，经 `file_save_segments` 批量 upsert（按 `uid`） |
| 禁止 | 写入 `detail`；独立 `segment_annotations` 表（v1） |

迁移：`db.rs` → `migrate_segments_annotation`（附加式 `ALTER TABLE`，旧库 backfill 空串）。

## 2. 边界情况矩阵

| # | 场景 | 期望 `annotation` | 备注 |
|---|------|-------------------|------|
| B1 | 首次添加 | 非空字符串 trim 后落库 | 弹窗保存 → `setSegments` + 自动保存 |
| B2 | 编辑已有 | 覆盖为新正文 | 菜单文案「编辑标注…」 |
| B3 | 清除 | `None` / 空串 | 弹窗「清除标注」；icon 隐藏 |
| B4 | 仅改标注 | 不变 `text_stage` | 与改字升阶路径解耦 |
| B5 | 合并，仅左有 | 保留左 | `mergeTwoSegments` |
| B6 | 合并，仅右有 | 保留右内容到左段 | |
| B7 | 合并，两侧都有 | `left + "\n\n---\n\n" + right` | 右段 row 删除 |
| B8 | 拆分 | 左继承 parent；右 `null` | `buildSplitPair` |
| B9 | 删除语段 | 随 row 删除 | CASCADE |
| B10 | 重转写整文件 | 全清空 | 确认文案提示（若已有重转写 confirm） |
| B11 | 撤销 / 编辑历史恢复 | 随 segment 快照恢复 | `save_segments` snapshot 含字段 |
| B12 | busy | 菜单 / 弹窗 / icon 点击 disabled | |
| B13 | 旧库无列 | migrate 后读为空 | Rust 单测 |
| B14 | bundle 导入导出 | roundtrip 保留 | `project_bundle_cmd` 若序列化 segments |

## 3. UI / 交互

### 3.1 右键菜单

扩展 [`segmentTextContextMenuModel.ts`](../../../apps/desktop/src/utils/segmentTextContextMenuModel.ts)：

| 条件 | 菜单项 |
|------|--------|
| `origin === segmentList` 且无选区 | **添加标注…** / **编辑标注…**（有非空 annotation 时）→ 定稿 → 删/并 → 文本外观 |
| 有选区 | **添加标注…** / **编辑标注…** → 更正记忆 → 定稿 → 删/并 |
| `origin === waveform` | v1 **不提供** 标注入口（仅删/并/拆） |

路由：[`EditorView.onSegmentCtxMenuSelect`](../../../apps/desktop/src/components/EditorView.tsx) → `openSegmentAnnotationDialog(segmentIdx)`。

### 3.2 弹窗

**新建** [`SegmentAnnotationDialog.tsx`](../../../apps/desktop/src/components/SegmentAnnotationDialog.tsx)：

- 壳：`DialogOverlay` + 与 `DeleteProjectConfirmDialog` 同级的 modal 卡片（非 draggable 浮动面板）
- 只读：语段序号、时间范围、正文摘要（单行 truncate）
- 可编辑：多行 `textarea`（`PANEL_CONTROL_TYPOGRAPHY.compactInput`）
- 操作：取消 · **清除标注**（danger ghost，仅已有标注时）· 保存（primary）

**新建** [`useSegmentAnnotationController.ts`](../../../apps/desktop/src/pages/useSegmentAnnotationController.ts)：

- state：`{ phase: "closed" } | { phase: "edit"; segmentIdx; draft }`
- `openSegmentAnnotationDialog(idx)` / `close` / `save` / `clear`
- save：更新 `segments[idx].annotation`，触发与改字相同的 persist 路径（`markDirty` / 自动保存）

挂载：[`ProjectPanelDialogs.tsx`](../../../apps/desktop/src/components/ProjectPanelDialogs.tsx)。

### 3.3 行尾图标

在 `apps/desktop/src/components/segmentRow/SegmentRowStageBadge.tsx` 内（或子组件 `SegmentRowAnnotationMarker.tsx`）：

- 条件：`segment.annotation?.trim()` 非空
- 图标：lucide `FileText`，`LUCIDE_ICON_SIZE_SM`，`text-notion-text-muted`
- `title` / `aria-label`：首行预览 ≤80 字
- 点击：阻止冒泡，调用 `onOpenAnnotation?(index)`（由 `EditorSegmentList` 透传 controller）
- 布局：标注 icon **置于 stage chip 上方**（`flex-col`），窄窗不挤正文

## 4. 落位文件

| 层 | 模块 | 变更 |
|----|------|------|
| DB | `apps/desktop/src-tauri/src/db.rs` | `migrate_segments_annotation` |
| Rust | `project/types.rs`, `segment_cmd.rs`, `utils.rs`（row mapping） | 读写 `annotation` |
| Rust 测试 | `segment_cmd_tests.rs`, `db.rs` tests | migrate + roundtrip |
| TS 类型 | `tauri/projectTypes.ts`, `projectApi.ts` | DTO 映射 |
| 纯函数 | `segmentListHelpers.ts` | merge/split/equal |
| 菜单 | `segmentTextContextMenuModel.ts`, `EditorView.tsx` | 项 + 路由 |
| Controller | **新建** `useSegmentAnnotationController.ts` | 挂 `useProjectLifecycleController` |
| API 面 | `ProjectLifecycleApi.ts`, `useProjectController.ts` | 透传 |
| UI | **新建** `SegmentAnnotationDialog.tsx`；改 `SegmentRowStageBadge`, `SegmentTextListRow`, `EditorSegmentList` | |
| 对话框 | `ProjectPanelDialogs.tsx` | 渲染 |

## 5. 实施顺序（纵向薄片）

| 步 | 内容 | 验证 |
|----|------|------|
| **A1** | migrate + Rust/TS DTO + save/load roundtrip | Rust test + typecheck |
| **A2** | `mergeTwoSegments` / `buildSplitPair` / `segmentsEqualForPersist` | `segmentListHelpers.test.ts` |
| **A3** | controller + dialog + ProjectPanelDialogs | 手测 open/save/clear |
| **A4** | 右键菜单 + EditorView 路由 | `segmentTextContextMenuModel.test.ts` |
| **A5** | 行尾 FileText + 点击编辑 | 手测 tooltip / 窄窗 |

## 6. 验证命令

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

定向测试：

- `apps/desktop/src/pages/segmentListHelpers.test.ts`
- `apps/desktop/src/utils/segmentTextContextMenuModel.test.ts`
- `apps/desktop/src-tauri/src/db.rs`（migrate）
- `apps/desktop/src-tauri/src/project/segment_cmd_tests.rs`（若已有 roundtrip）

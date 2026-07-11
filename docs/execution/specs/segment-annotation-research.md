# 调研：语段标注（右键添加 · 行尾文件图标）

> **状态**：规划门禁（2026-06-07）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)（编辑工作台 · 纵向薄片）  
> **关联 spec**：[`segment-annotation-intent.md`](./segment-annotation-intent.md) · [`segment-annotation-plan.md`](./segment-annotation-plan.md) · [`segment-annotation-acceptance.md`](./segment-annotation-acceptance.md)  
> **前置**：语段阶段徽标 [`segment-edit-stage-indicator-research.md`](./segment-edit-stage-indicator-research.md)；协作存储草案 [`collaboration-storage-schema.md`](../../architecture/collaboration-storage-schema.md)；翻译模块批注草案 [`translation-dictionary-module.md`](./translation-dictionary-module.md) §3.1 `segment_annotations`  
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 口述史 / 转写审校时，转录员或研究者需在 **单条语段** 上记录 **非正文** 信息（背景、存疑、待核对人名、引用来源等），不打断正文编辑流；有标注的语段应在列表 **右侧可扫见**（小文件图标），便于跳读与导出前自检。 |
| **本仓现状** | **数据**：[`SegmentDto`](../../../apps/desktop/src/tauri/projectTypes.ts) 含 `text` / `text_stage` / `detail` 等；SQLite `segments` 表 **无** 用户标注字段。**`detail` 已被 ASR 占用**（如 `funasr_whole_track_fallback` 占位判定，见 [`segmentListHelpers.ensureExplicitSegmentKinds`](../../../apps/desktop/src/pages/segmentListHelpers.ts)），**不可复用** 为用户标注。<br>**交互**：语段列表已有完整右键链：<br>· 行级：`apps/desktop/src/components/SegmentTextListRow.tsx` → [`buildSegmentRowContextMenuItems`](../../../apps/desktop/src/utils/segmentTextContextMenuModel.ts)（删 / 并 / 定稿 / 文本外观）<br>· 正文区：`apps/desktop/src/components/segmentRow/SegmentRowTextField.tsx` 单独 `onOpenTextContextMenu`（选区 → 更正记忆 + 语段操作）<br>· 菜单壳：[`SegmentContextMenu`](../../../apps/desktop/src/components/SegmentContextMenu.tsx) + [`EditorView.onSegmentCtxMenuSelect`](../../../apps/desktop/src/components/EditorView.tsx)<br>**右侧列**：`apps/desktop/src/components/segmentRow/SegmentRowStageBadge.tsx` 已占「定稿阶段 chip + 未保存圆点」，可 **并列** 增加标注图标，不挤正文。<br>**持久化**：语段经 [`file_save_segments`](../../../apps/desktop/src-tauri/src/project/segment_cmd.rs) 批量 upsert（按 `uid`）；[`segmentsEqualForPersist`](../../../apps/desktop/src/pages/segmentListHelpers.ts) 驱动脏检查；合并 / 拆分见 [`mergeTwoSegments`](../../../apps/desktop/src/pages/segmentListHelpers.ts) / [`buildSplitPair`](../../../apps/desktop/src/pages/segmentListHelpers.ts)。<br>**架构草案**：[`translation-dictionary-module.md`](./translation-dictionary-module.md) 已有 `segment_annotations` 表（按 `file_id + idx`，含子范围）；[`collaboration-storage-schema.md`](../../architecture/collaboration-storage-schema.md) 规划 `annotation_threads`（多用户审阅）。**均未落地**。 |
| **成功标准** | （1）语段正文或行空白处右键 →「添加/编辑标注」→ 弹窗保存；（2）有非空标注的语段行尾显示 **File 图标**（hover 预览首行）；（3）保存 / 重开文件 / 撤销栈后标注仍在；（4）合并 / 拆分 / 重转写行为有 documented 规则；（5）`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 通过。 |

### 1.1 与现有概念边界

| 概念 | 关系 |
|------|------|
| `SegmentDto.detail` | **ASR / 引擎元数据**，禁止写入用户标注 |
| `text_stage` / 定稿徽标 | **编辑阶段**；与标注 **正交**，同行并列展示 |
| 更正记忆 / 术语表 | **全局** 规则或词条；标注是 **per-segment 自由文本**，v1 不自动进 glossary |
| `edit_log` | 可选记录 `annotation_change`；**不**替代当前标注真源 |
| 协作域 `annotation_threads` | R8+ 多用户线程；v1 **单机整段 note**，字段设计 **可前向兼容**（见 §4.3） |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表产品 | 核心机制 | 可验证链接 / 路径 |
|---|------|----------|----------|-------------------|
| **A** | **口述史 · 多层时间轴标注** | [ELAN](https://archive.mpi.nl/tla/elan) · [OHMS](https://www.oralhistory.org/oral-history-metadata-synchronizer/) · Transana | 转写与时间轴 **分层**（transcription tier / annotation tier）；注释与正文 **不同轨**，导出可含 notes 层 | MPI ELAN 文档；OHMS Viewer 同步索引+转写 |
| **B** | **文稿编辑器 · 段/块旁注** | [Descript](https://help.descript.com/) · Trint · Sonix | 改稿以正文为中心；**评论/备注** 挂段落或选区，侧栏或 margin marker；偏 **协作审阅** | Descript Comments；Trint Editor |
| **C** | **CAT / 翻译网格 · 段状态+备注** | memoQ · [LILT](https://support.lilt.com/kb/segment-state-indicators) | 每段独立 **状态列 + 备注/comment**；可筛选「有备注段」；备注 **不进 TM 正文** | memoQ segment comments |
| **D** | **Office 式 margin comment** | Google Docs · Word | 选区锚点 + 线程回复 + resolve；**字符范围** 真源，换行/改字需 anchor 修复 | — |

### 2.1 路线对照（与 Rushi 诉求）

| 维度 | Rushi v1 目标 | A 口述史 | B 转写编辑器 | C CAT | D Office |
|------|---------------|----------|--------------|-------|----------|
| 粒度 | **整段** 自由文本 | tier / 时间区间 | 段或选区 | 段 | 字符范围 |
| 入口 | **右键 → 弹窗** | 独立 tier 编辑 | 侧栏 comment | 网格备注列 | margin |
| 列表提示 | **行尾小图标** | tier 可见性切换 | marker / 高亮 | 状态/图标列 | margin 色条 |
| 协作 | v1 单机 | 单机为主 | 云端协作 | 项目级 | 强协作 |
| 与音频 | 语段时间已有 | 强绑定 | 中 | 弱 | 弱 |

**结论**：Rushi 场景（口述史 + 单机转写台）更接近 **A 的「正文与注释分层」** 产品原则 + **B/C 的「段旁一条 note + 列表扫读图标」** 交互形态；v1 **不做** D 级字符锚点与线程回复。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| **A ELAN/OHMS** | **中** | 注释与正文分离、导出可带 notes | 独立 tier UI **过重**；Rushi 已有语段+波形一体工作台 | 纯本地 SQLite |
| **B Descript/Trint** | **高** | 右键/侧栏入口、段级 marker、预览 tooltip | 云端线程模型 v1 不做 | 无网络依赖 |
| **C CAT** | **中** | 段级备注列、筛选「有备注」 | 第三列占宽；应用 **图标+弹窗** 代替整列 | 需 DB 字段 |
| **D Office** | **低** | — | 字符 anchor 与 [`mergeTwoSegments`](../../../apps/desktop/src/pages/segmentListHelpers.ts) / draft 不同步，复杂度高 | — |

**本仓已有可复用模块**（须扩展，禁止平行真源）：

| 模块 | 路径 | 复用于标注 |
|------|------|------------|
| 右键菜单模型 | [`segmentTextContextMenuModel.ts`](../../../apps/desktop/src/utils/segmentTextContextMenuModel.ts) | 新增 `addAnnotation` / `editAnnotation` 项 |
| 菜单路由 | [`EditorView.tsx`](../../../apps/desktop/src/components/EditorView.tsx) | `onSegmentCtxMenuSelect` 分支 |
| 弹窗模式 | [`DeleteProjectConfirmDialog`](../../../apps/desktop/src/components/DeleteProjectConfirmDialog.tsx) · [`useManualCorrectionMemoryDialog`](../../../apps/desktop/src/pages/useManualCorrectionMemoryDialog.ts) | 标注 dialog state + `DialogOverlay` / `compactDialog` |
| 语段行右列 | `apps/desktop/src/components/segmentRow/SegmentRowStageBadge.tsx` | 并列 `FileText` 图标（lucide） |
| 语段持久化 | [`segment_cmd.rs`](../../../apps/desktop/src-tauri/src/project/segment_cmd.rs) · [`useProjectSaveController`](../../../apps/desktop/src/pages/useProjectSaveController.ts) | 扩展 save/load 字段 |
| 合并 / 拆分 | [`segmentListHelpers.ts`](../../../apps/desktop/src/pages/segmentListHelpers.ts) | 标注继承规则 |
| 脏检查 | `segmentsEqualForPersist` | 纳入 `annotation` |
| 排版 token | [`typography.ts`](../../../apps/desktop/src/config/typography.ts) · [`controlStyles.ts`](../../../apps/desktop/src/config/controlStyles.ts) | 弹窗与 tooltip |

---

## 4. 决策摘要

### 4.1 选定方案：v1 整段单条标注 · `SegmentDto.annotation` 持久化

| 问题 | 结论 |
|------|------|
| **存储** | SQLite `segments` 表新增 **`annotation TEXT NOT NULL DEFAULT ''`**（空串 = 无标注）；[`SegmentDto`](../../../apps/desktop/src-tauri/src/project/types.rs) 增加 `annotation: Option<String>`（serde 空串 → None）。**不走** `detail`；**v1 不建** 独立 `segment_annotations` 表（减少第二条写路径与 load join）。 |
| **粒度** | **整段一条** 自由文本（多行 textarea）；v1 **不支持** 选区子范围标注。 |
| **入口** | 语段列表 **正文区右键**（含无选区）与 **行空白右键** 均显示「添加标注…」/「编辑标注…」；与「标记定稿 / 删除 / 合并」同菜单。**无选区时** 菜单顺序建议：标注 → 定稿 → 删/并 → 文本外观。 |
| **弹窗** | `DialogOverlay` + `compactDialog` 风格（见 [`desktop-floating-dialog-panels.md`](../../architecture/desktop-floating-dialog-panels.md)）；字段：多行正文 + 保存 / 取消 / **清除标注**；显示语段时间戳 + 正文摘要（只读）。 |
| **行尾图标** | 非空标注时，在 `apps/desktop/src/components/segmentRow/SegmentRowStageBadge.tsx` 区域显示 **`FileText`**（`LUCIDE_ICON_SIZE_SM`），`text-notion-text-muted`，hover/focus `title` 为首行预览（≤80 字）；点击图标 **同** 打开编辑弹窗。 |
| **保存时机** | 弹窗「保存」→ 更新内存 `segments` + 触发既有 **自动保存**（与改字相同）；纳入 `segmentsEqualForPersist`。 |
| **不做什么（v1）** | 字符范围标注；多线程回复；@mention；导出 DOCX 附录（可 Phase B）；审阅模式开关；在线协作同步；把标注自动写入 glossary / correction memory |
| **与 ADR / architecture** | 单机 transcription 模式扩展；命名 **`annotation`** 对齐协作域 thread body，未来可迁移到 `annotation_threads`（§4.3） |

### 4.2 语段生命周期规则（须写入 acceptance）

| 操作 | 标注行为 |
|------|----------|
| **编辑 / 保存** | 仅改 `annotation` 不影响 `text_stage` |
| **合并** `mergeTwoSegments` | 若仅一侧有标注 → 保留；**两侧都有** → 左段标注 + `\n\n---\n\n` + 右段标注（右段 idx 消失） |
| **拆分** `buildSplitPair` | **左段继承** 原标注；**右段** `annotation` 为空 |
| **删除语段** | 随 segment row 删除（同 file cascade） |
| **重转写**（整文件替换语段） | **清空** 全部标注（与 uid 重置一致；acceptance 须提示用户） |
| **撤销 / 重做** | 随 [`edit_log` 快照] 恢复 `annotation`（与 text 同快照） |

### 4.3 前向兼容（Phase B+，v1 不实现）

| 演进 | 路径 |
|------|------|
| 多条标注 / 子范围 | 迁移到 [`segment_annotations`](./translation-dictionary-module.md) 或 [`annotation_threads`](../../architecture/collaboration-storage-schema.md)，**键改为 `segment_uid`**（禁止仅用 `idx`） |
| 导出 | DOCX / 交付包 appendix「语段注释」节 |
| 筛选 | 工具条「仅有标注」过滤；底栏计数 |
| 协作 | `annotation_threads` + `workflow_mode=review` 控制 marker 显隐（协作 schema 已描述） |

### 4.4 风险与 spike 项

| 风险 | 缓解 |
|------|------|
| 右列过挤（定稿 chip + 标注 icon + 窄窗） | 标注 icon 在 chip **上方** 或 **左侧** 堆叠；窄窗 `apps/desktop/src/components/segmentRow/SegmentRowStageBadge.tsx` 模式仅 icon |
| 右键菜单项过多 | 标注与定稿放 **主层**；文本外观保持子菜单 |
| 重转写丢标注 | 重转写确认文案增加一句；Phase B 可选备份 |
| `detail` 误用 | code review + Rust 层禁止把 user input 写入 `detail` |

**Spike（≤0.5d，可选）**：在 `SegmentRowStageBadge`  mock 双 icon 布局 + 320px 窄窗截图，确认不挤正文（**不** 当终态代码）。

---

## 5. 落位预告（Plan / 编码）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| **DB** | [`db/mod.rs`](../../../apps/desktop/src-tauri/src/db/mod.rs) | `migrate_segments_annotation` → `ALTER TABLE segments ADD COLUMN annotation TEXT NOT NULL DEFAULT ''` |
| **Rust 类型** | [`project/types.rs`](../../../apps/desktop/src-tauri/src/project/types.rs) | `SegmentDto.annotation` |
| **Rust 读写** | [`segment_cmd.rs`](../../../apps/desktop/src-tauri/src/project/segment_cmd.rs) · bundle/import | SELECT/INSERT/UPDATE 含 `annotation` |
| **TS 类型** | [`projectTypes.ts`](../../../apps/desktop/src/tauri/projectTypes.ts) | 对齐 DTO |
| **合并 / 脏检查** | [`segmentListHelpers.ts`](../../../apps/desktop/src/pages/segmentListHelpers.ts) | merge/split/equal |
| **Controller** | **新建** `useSegmentAnnotationController.ts` | dialog open/save/clear；挂 `useProjectLifecycleController` |
| **UI 弹窗** | **新建** `SegmentAnnotationDialog.tsx` | `DialogOverlay` + textarea |
| **UI 图标** | `apps/desktop/src/components/segmentRow/SegmentRowStageBadge.tsx` 或 **新建** `SegmentRowAnnotationMarker.tsx` | FileText + click |
| **菜单** | [`segmentTextContextMenuModel.ts`](../../../apps/desktop/src/utils/segmentTextContextMenuModel.ts) · [`EditorView.tsx`](../../../apps/desktop/src/components/EditorView.tsx) | 菜单项 + 路由 |
| **对话框挂载** | [`ProjectPanelDialogs.tsx`](../../../apps/desktop/src/components/ProjectPanelDialogs.tsx) | 渲染 `SegmentAnnotationDialog` |
| **测试** | `segmentListHelpers.test.ts` · `segmentTextContextMenuModel.test.ts` · Rust `segment_cmd` 测试 | merge 标注 / 空串 / migrate |

**禁止**：第二套 annotation 存 `localStorage`；用 `detail` 存用户文本；仅前端内存不落库。

---

## 6. 建议实施顺序（Plan 薄片）

1. **Schema + DTO + save/load + tests**（无 UI）  
2. **merge/split/equal + edit_log 快照**  
3. **右键菜单 + controller + dialog**  
4. **行尾 FileText 图标 + tooltip + 点击编辑**  
5. **手测矩阵**（添加 / 编辑 / 清除 / 合并 / 拆分 / 撤销 / 重开文件 / 重转写提示）  

验证：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

---

## 7. 能力—UI 状态矩阵（acceptance 必填草稿）

| 能力 | UI 表面 | 无标注 | 有标注 | busy |
|------|---------|--------|--------|------|
| 查看 marker | 行尾 FileText | 隐藏 | 显示 + tooltip | 显示，点击 disabled |
| 添加 | 右键「添加标注…」 | 可用 | —（改为「编辑标注…」） | disabled |
| 编辑 | 弹窗 / 点 icon | — | 预填正文 | disabled |
| 清除 | 弹窗「清除标注」 | — | 可用 | disabled |
| 持久化 | 自动保存 | — | 脏检查含 annotation | — |

---

## 8. 签收

- [x] 调研 brief 完成  
- [x] intent / plan / acceptance 已链接本文  
- [x] 用户确认可进入编码（2026-06-07）  

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-07 | 初版：语段标注 v1 方案（整段单条 · `SegmentDto.annotation` · 右键弹窗 · 行尾 FileText） |
| 2026-06-07 | 链入 intent / plan / acceptance；用户确认进入编码 |

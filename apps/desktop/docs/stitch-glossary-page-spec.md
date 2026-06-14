# 热词与记忆页 — Stitch 重设计需求稿（Layout v2）

> **版本**：2026-06-12  
> **真源**：仓库根 [`DESIGN.md`](../../../DESIGN.md)（Notion Zen）  
> **关联实现 spec**：[`glossary-page-restyle-plan.md`](../../../docs/execution/specs/glossary-page-restyle-plan.md)（v1 样式对齐，已落地）  
> **静态对照**：[`stitch-glossary-page-layout.html`](../stitch-glossary-page-layout.html)  
> **手测清单**：[`hot-ux-hand-test-checklist.md`](../../../docs/execution/specs/hot-ux-hand-test-checklist.md)

本文描述 **欢迎页主舞台「热词与记忆」**（`WelcomeView` · `page === "glossary"`）的 **Layout v2 彻底重构**：从单栏纵向堆叠改为 **环境页式左导航 + 右工作区 Master–Detail**。  
**本轮 Stitch 交付布局与组件规格**；业务逻辑、Tauri 接口、controller 数据流 **不变**。

---

## 0. 代码真源（现状）

| 区域 | 入口 |
|------|------|
| 页面壳 | [`GlossaryPage.tsx`](../src/components/GlossaryPage.tsx) |
| 编排 | [`useGlossaryPageController.ts`](../src/pages/useGlossaryPageController.ts) |
| 转写词汇表 | [`GlossaryTermManagementSection.tsx`](../src/components/glossary/GlossaryTermManagementSection.tsx) · [`GlossaryTermTable.tsx`](../src/components/glossary/GlossaryTermTable.tsx) · [`GlossaryTermEditor.tsx`](../src/components/glossary/GlossaryTermEditor.tsx) |
> **代码对照（2026-06）**：`GlossaryHotwordsSummarySection` / `GlossaryLexiconBundleSection` 已移除；以当前 `GlossaryPanel` 为准。
| 推荐采纳 | [`GlossaryMineSection.tsx`](../src/components/glossary/GlossaryMineSection.tsx) |
| 纠错记忆 | [`GlossaryCorrectionMemorySection.tsx`](../src/components/glossary/GlossaryCorrectionMemorySection.tsx) · [`CorrectionMemoryTable.tsx`](../src/components/glossary/CorrectionMemoryTable.tsx) |
| 词表包 | [`GlossaryLexiconBundleSection.tsx`](../src/components/glossary/GlossaryLexiconBundleSection.tsx) |
| 共享样式 | [`glossaryPanelStyles.ts`](../src/components/glossary/glossaryPanelStyles.ts) · [`controlStyles.ts`](../src/config/controlStyles.ts) |
| 领域纪律 | [`asr-vocabulary-bias-practices.md`](../../../docs/architecture/asr-vocabulary-bias-practices.md) · [`desktop-capability-ui-state-alignment.md`](../../../docs/architecture/desktop-capability-ui-state-alignment.md) |
| 壳层参照 | [`EnvironmentPanel.tsx`](../src/components/EnvironmentPanel.tsx)（左 nav + 右 scroll main） |

**入口上下文**：用户从 [`WelcomeSidebar`](../src/components/WelcomeSidebar.tsx) 点击「热词与记忆」进入；顶栏为 [`WelcomeTopBar`](../src/components/WelcomeTopBar.tsx)（ASR/LLM 芯片），**不是**浮动环境面板。

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| **双工作区分离** | 「转写词汇表」与「纠错记忆」是两种心智模型，须在布局层分区，而非同一长页滚屏 |
| **列表优先** | 首屏主体是可扫读的术语/记忆列表；新建、批量、词表包不占主舞台 |
| **Master–Detail** | 选中行 → 右侧检视器编辑；未选中时右栏空态引导 |
| **与环境页同族** | 页内左 nav 192px、选中 saffron 左条、右 main 白底 scroll — 与 `EnvironmentPanel` 一致 |
| **可落地** | 颜色/圆角/按钮高以 `tailwind.config.js` + `controlStyles.ts` 为准；禁止未入库 hex |

**不做什么**

- 不把纠错记忆与术语表合并为一张表（错形 ≠ 正形）
- 不新增第三套全局页面路由（仍在 `WelcomePageId: "glossary"`）
- 不在 Stitch 稿中写死厂商 API / 热词算法细节（摘要文案来自后端 preview）
- 不使用 drop shadow 卡片堆叠（Notion Zen：边框 + 背景色差）

---

## 2. 用户场景与成功标准

| 场景 | 用户目标 | 成功标准（设计须支持） |
|------|----------|------------------------|
| **转写前检查热词** | 确认下次 ASR 将携带哪些正形 | 词汇表工作区顶栏 sticky 摘要可见；截断有 saffron 警告 |
| **添加专名** | 快速录入并纳入热词 | 工具栏「添加词条」→ 右检视器 create 态；保存后列表 + 摘要同步 |
| **批量导入** | Excel 粘贴 / CSV | 「批量添加」在对话框或折叠区，不挤压列表首屏 |
| **编辑后闭环** | 稳定纠错 → 术语表 | 「推荐加入术语表」banner 仅在词汇表区出现；一键采纳 |
| **管理纠错规则** | 查看命中、采纳为规则 | 记忆工作区列表 + 检视器；冲突 banner 置顶 |
| **小团队交换** | 导入/导出词表包 | 低频：左 nav 第三项或页头 `⋯`，不占首屏 |
| **从转写对话框跳入** | `AutoTranscribeStartDialog` → 热词页 | 深链到词汇表工作区 + 摘要区可见（实现 P2，Stitch 预留 nav 选中态） |

**心智模型（须在 copy / 空态中强化）**

1. **转写词汇表** = 只收录希望 **听成** 的正形；勾选热词 → **下次** ASR。  
2. **纠错记忆** = 错→对；错形 **不会** 进入热词串；满 3 次或采纳 → 影响 **当前稿** 改正 / F1。  
3. 二者勿混用：别名栏勿填常听错的错形。

---

## 3. 现状问题（v2 重设计动机）

| # | 问题 | v2 对策 |
|---|------|---------|
| P1 | 单栏 `max-w-4xl` 纵向堆叠，列表沉到第二屏 | 左 nav 切换 + 列表占右区 55%+ |
| P2 | 新建表单、批量区、词表包与列表争抢首屏 | 检视器 / 对话框 / nav 底部 |
| P3 | 两张表 + 两个编辑器视觉重复 | 统一 Master–Detail 模板 |
| P4 | 携带摘要与说明文过长 | sticky 一行摘要 + 折叠详情 |
| P5 | 行内双按钮（Flame + 移出热词）噪音 | 仅 Flame toggle；删除 hover-reveal |
| P6 | 与环境页、欢迎 Hub 布局语言不一致 | 复用 Environment 左 nav 规格 |

---

## 4. 页面外壳（Welcome 主舞台内）

```
┌─ WelcomeTopBar（全局，非本页设计范围）────────────────────────────┐
├──────────┬──────────────────────────────────────────────────────┤
│ Welcome  │ ┌─ 热词与记忆 页头 ──────────────────────────────────┐ │
│ Sidebar  │ │ [BookOpen] 热词与记忆 · 一行副标题                    │ │
│ （已有） │ ├──────────┬───────────────────────────────────────────┤ │
│          │ │ 页内 nav │ 右工作区（flex-1 · overflow-y-auto）       │ │
│          │ │ 192px    │ 当前 workspace 内容                        │ │
│          │ │          │                                           │ │
│          │ └──────────┴───────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────────┘
```

| 属性 | 值 | 说明 |
|------|-----|------|
| 页面底 | `bg-notion-bg` | 与欢迎页主舞台一致 |
| 水平 padding | `px-10 py-8` | 与现 `GlossaryPage` 一致 |
| 内容最大宽 | **无** `max-w-4xl` 限制 | v2 全宽利用主舞台（`flex-1`） |
| 页头 | 图标 40×40 + `envPageTitle` + `envPageSubtitle` | 副标题保留双通道说明，**一行**；详细机制收折叠 |
| 页内壳 | `flex flex-row min-h-0 flex-1` | 头以下全高 |

**Two-Layer Border Rule**

- 第 1 层：页内壳外框（可选，或与主舞台融合仅 nav 右边线）
- 第 2 层：列表区外框 `border-notion-divider`
- 检视器、摘要条、banner：**禁止**再加容器 border，用 `bg-notion-sidebar/60` 或 `bg-notion-callout-bg` 区分

---

## 5. 页内左导航（3 workspaces）

| id | 标签 | 描述（11px truncate） | 图标 Lucide | 待办点 |
|----|------|----------------------|-------------|--------|
| `vocabulary` | 转写词汇表 | 下次 ASR 热词 | `BookOpen` | 有 mine 推荐时 saffron 点 |
| `memory` | 纠错记忆 | 错→对 · 编辑规则 | `Sparkles` | 有冲突时 cinnabar 点 |
| `bundle` | 词表包 | 小团队导入导出 | `FileSpreadsheet` | 无 |

**Stitch 定稿（对齐 Environment nav）**

- 宽 **192px**（`w-48`）
- 选中：`bg-notion-sidebar-active` + **左侧 4px `zen-saffron` 竖条**
- 每项：图标 MD 18px + 标题 12px semibold + 描述 11px muted
- 可选右侧 **6px 状态点**（推荐/冲突）
- nav 顶部小标题：**「工作区」** 或省略（页头已有「热词与记忆」）

**禁止**：侧栏底部订阅 CTA、第二套全局导航重复 WelcomeSidebar 项。

---

## 6. 工作区 A — 转写词汇表（主路径）

### 6.1 信息架构

```
┌─ 转写词汇表 workspace ─────────────────────────────────────────────┐
│ [Sticky] 本次转写将携带 · 12 词 · 37 字 / 12,000  [详情▾] [去环境]  │
│ [可选 Banner] 推荐加入术语表 · 2 条待采纳  [采纳选中] [忽略]          │
├──────────────────────────────┬─────────────────────────────────────┤
│ 列表区 ~58%                   │ 检视器 ~42%                          │
│ 工具栏：筛选|搜索|刷新|+添加|⋯  │ 未选：空态插画 + 「选择或添加词条」    │
│ 批量条（有选中时）             │ 已选：GlossaryTermEditor 字段组        │
│ 表格（热词/主术语/别名/…）      │ [保存] [删除]                        │
└──────────────────────────────┴─────────────────────────────────────┘
```

### 6.2 Sticky 携带摘要条

| 元素 | 规格 |
|------|------|
| 容器 | `bg-notion-callout-bg` · `px-4 py-2.5` · **无 border**（或仅底 `border-b` 发丝线） |
| 主文案 | `body` 12px：`自动转录时将提交 12 个热词（12 条已纳入词条）` — **实现真源，勿写死** |
| 辅文案 | 截断时 saffron：`超出上限，实际提交 10 个…` |
| 右侧 | Ghost「详情」折叠 preview；可选 Link「环境与 ASR」 |
| 折叠内容 | mono 11px preview `香板 提持 上座…`；机制说明 11px muted |

### 6.3 推荐 banner（`GlossaryMineSection`）

- **仅** `vocabulary` workspace、有推荐行时显示
- 形态：`bg-zen-saffron/10` · 单行标题 + 操作按钮行；**不是**独立大卡片
- 列表项可收敛为「2 条待采纳」+ 展开 details

### 6.4 列表工具栏

| 控件 | 类型 | 说明 |
|------|------|------|
| 热词筛选 | `CONTROL_SELECT_INLINE` | 全部 / 仅已纳入 / 仅未纳入 |
| 搜索 | `CONTROL_TEXT_INPUT` + Search 图标 | placeholder：搜索术语、别名、领域、备注 |
| 刷新 | `CONTROL_BTN_ICON` | |
| 添加词条 | `CONTROL_BTN_PRIMARY` + Plus | 打开检视器 create |
| 更多 `⋯` | Ghost menu | 批量添加…、从表格导入…、导出 CSV |

### 6.5 术语表（列表）

| 列 | 宽 | 说明 |
|----|-----|------|
| □ | 40px | 批量选择 |
| 热词 | 48px | Flame toggle 28×28；on = saffron/15 底 |
| 主术语 | flex | semibold；点击选中 → 检视器 |
| 别名 | 120px | muted truncate |
| 领域 | 96px | muted |
| 备注 | 140px | muted truncate |
| 更新 | 112px | tabular 时间 |
| 操作 | 72px | **仅**删除；`opacity-0` → hover/focus 显现；确认删除常显 |

**行高**：40–44px；hover `bg-notion-sidebar-hover/60`；选中 `bg-zen-saffron/10`。

### 6.6 检视器（Inspector）

| 状态 | 内容 |
|------|------|
| Empty | 居中 muted：「选择左侧词条编辑，或点击添加词条」 |
| Create | 字段：主术语*、纳入热词 checkbox、别名、领域、备注；Primary「添加词条」 |
| Edit | 同 create + 标题「编辑词条」+ Danger「删除」+ Ghost「取消」 |

卡片：`GLOSSARY_CARD` = 白底 + 1px `notion-border` + `rounded-md` + `p-4`。

### 6.7 对话框（不进主布局）

| 对话框 | 触发 | 壳 |
|--------|------|-----|
| 批量添加 | 工具栏 ⋯ | `compactDialog` · textarea 4 行 + Primary「批量添加」 |
| 从表格导入 | ⋯ | 系统文件 / 现有流程 |
| 导出 CSV | ⋯ | 直接下载 |

---

## 7. 工作区 B — 纠错记忆

### 7.1 信息架构

```
┌─ 纠错记忆 workspace ───────────────────────────────────────────────┐
│ 页眉：纠错记忆 · 7 条 · 5 条稳定 · 一行说明（可折叠）                │
│ [冲突 Banner] 同错形多种正词（有才显示）                             │
├──────────────────────────────┬─────────────────────────────────────┤
│ 列表 ~58%                     │ 检视器 ~42%                          │
│ 工具栏：搜索|刷新|+新建记忆      │ Empty / Create / Edit               │
│ 批量条                        │ 错词 | 正词 · 命中 · 采纳为规则        │
│ 表格                          │                                     │
└──────────────────────────────┴─────────────────────────────────────┘
```

### 7.2 记忆表

| 列 | 说明 |
|----|------|
| □ | 批量 |
| 错词 | 可点击选中 |
| 正词 | |
| 命中 | tabular-nums |
| 状态 | badge：已采纳 / 学习中 / 已稳定（saffron 或 sidebar 底） |
| 操作 | 「采纳」hover-reveal；已采纳显示 — |

### 7.3 检视器字段

- 错词 / 正词（并排 2 列）
- checkbox：采纳为规则（立即 F1 / 转写提示）
- 说明 11px meta（一条）
- Primary「保存」· Edit 态 Danger「删除本条」
- **底部关联**（P2 可选）：「正词 `制控` 已在术语表」/「未在术语表 → 加入」

### 7.4 冲突 Banner

- 保留 [`CorrectionMemoryConflictBanner`](../src/components/glossary/CorrectionMemoryConflictBanner.tsx) 语义
- 列表上方全宽；`bg-zen-saffron/10` + Alert 图标
- 每条冲突：错形 → 正词列表 (hit N)

---

## 8. 工作区 C — 词表包

低频；两种 Stitch 方案 **二选一**（定稿时勾选）：

| 方案 | 布局 |
|------|------|
| **A（推荐）** | 左 nav 第三项；右区简单说明 + 两个 Secondary 按钮（导出…/导入…）+ 状态/错误文案 |
| B | 词汇表工具栏 `⋯` 菜单内；nav 仅两项 |

按钮：`CONTROL_BTN_SECONDARY` + Download / FileSpreadsheet 图标。  
导入导出预览仍用现有 `LexiconBundleExportDialog` / `ImportDialog`（`compactDialog`）。

---

## 9. 设计令牌（与 v1 一致）

| Token | 用途 |
|-------|------|
| `notion-bg` / `notion-sidebar` | 主区 / nav / 表头 |
| `notion-divider` / `notion-border` | 分割 / 卡片边 |
| `notion-callout-bg` | 携带摘要、批量条、空态 |
| `zen-saffron` | Primary、热词 on、稳定/已采纳 badge |
| `zen-cinnabar` | 删除、错误、冲突点 |
| `zen-success` | 可选：摘要「就绪」 |

**排版**

| 级别 | class | 用途 |
|------|-------|------|
| 页标题 | `envPageTitle` 24px | 热词与记忆 |
| 工作区标题 | `envSectionTitle` 14px | 转写词汇表 / 纠错记忆 |
| 区块 | `sectionTitle` 12px | 检视器标题 |
| 字段 | `fieldLabel` 11px | 表单标签 |
| 辅助 | `meta` 11px / `helper` 12px | 说明、表脚 |

**控件**：`CONTROL_BTN_PRIMARY` / `SECONDARY` / `ICON` / `DANGER` · `CONTROL_TEXT_INPUT` · `CONTROL_TEXTAREA` · `CONTROL_SELECT_INLINE` — 均 **32px 高 · 4px 圆角**。

**图标**：Lucide SM 14 / MD 18；`strokeWidth=2`。Stitch 可用 Material Symbols，编码以 Lucide 为准。

---

## 10. 能力 — UI 状态矩阵（Stitch 必出 Frame）

| 状态 ID | 工作区 | 触发条件 | UI 表现 |
|---------|--------|----------|---------|
| V-default | vocabulary | 有数据、无选中 | 列表 + 空检视器 |
| V-selected | vocabulary | 选中一行 | 列表高亮 + 检视器 edit |
| V-create | vocabulary | 点击添加 | 检视器 create |
| V-empty | vocabulary | 0 词条 | 列表区 dashed 空态 + CTA |
| V-summary-trunc | vocabulary | hotwords 超 12k | sticky 摘要 saffron 警告 |
| V-mine | vocabulary | 有推荐行 | 摘要下 banner |
| V-batch | vocabulary | 勾选 ≥1 | 批量条在表上方 |
| M-default | memory | 有数据 | 列表 + 空检视器 |
| M-learning | memory | 学习中行 | 灰 badge + 行内采纳 |
| M-conflict | memory | 冲突组非空 | 冲突 banner 展开 |
| B-idle | bundle | 默认 | 说明 + 两按钮 |
| N-vocab-list | vocabulary | 窄屏、无抽屉 | 顶部分段 + 全宽列表（G9） |
| N-vocab-sheet | vocabulary | 窄屏、选中/新建 | 遮罩 + bottom sheet（G10） |
| N-memory-sheet | memory | 窄屏 | 记忆列表 + 抽屉（G11） |
| D-bulk-add | vocabulary | 打开批量对话框 | G12 叠加 G1 |

**加载 / 错误**

- 摘要：`正在加载热词摘要…`
- 列表错误：`GLOSSARY_ERROR_TEXT` cinnabar 条
- 禁用：`disabled:opacity-40`（`busy` 全局）

---

## 11. 响应式

| 断点 | 布局 |
|------|------|
| ≥1280px | 页内 nav 192 + 列表 58% + 检视器 42% |
| 1024–1279px | 列表 55% + 检视器 45%；工具栏换行 |
| <1024px | **见 §11.1**：顶部分段 nav；检视器改 **底部抽屉**；列表全宽 |

### 11.1 窄屏布局（<1024px，Stitch 必出 G9–G11）

**触发**：欢迎主舞台宽度 <1024px（小窗 / 分屏 / 未来平板）。**不**改全局 `WelcomeSidebar`（仍可折叠）；仅 **页内** 布局切换。

```
┌─ 热词与记忆（窄屏）────────────────────────────────────────┐
│ [BookOpen] 热词与记忆 · 副标题 truncate 一行                 │
├──────────────────────────────────────────────────────────┤
│ [Segmented]  转写词汇表 ● | 纠错记忆 | 词表包              │  ← 替代左侧 nav
├──────────────────────────────────────────────────────────┤
│ [Sticky] 本次转写将携带 · 12 词 · 37/12000 字  [详情▾]    │  ← 仅词汇表分段
├──────────────────────────────────────────────────────────┤
│ 工具栏（可换行）：筛选 | 搜索 | ↻ | +添加 | ⋯              │
│ 列表（全宽，列可隐藏别名/备注/更新）                        │
│ …                                                         │
├──────────────────────────────────────────────────────────┤
│ ░░░░░░░░░░░ 半透明遮罩（抽屉打开时）░░░░░░░░░░░░░░░░░░░░░ │
│ ┌─ Bottom Sheet ─────────────────────────────────────┐  │
│ │ ═══ drag handle 40×4px ───                         │  │
│ │ 编辑词条 / 新建词条                          [×]    │  │
│ │ （检视器字段，与桌面右栏相同）                       │  │
│ │ [保存] [删除]                                       │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

| 元素 | 窄屏规格 |
|------|----------|
| 顶部分段 | 复用环境页 `ENV_LLM_MODE_TOGGLE_TRACK` 视觉：轨道 `bg-secondary-container` · 选中项白底 + `shadow-sm` + saffron 字色；三项等宽或 `min-w` 自适应 |
| 页头副标题 | **单行** `truncate`；完整说明进 segmented 下方 `<details>` 或首次访问 tooltip |
| Sticky 摘要 | 保留；第二行 saffron 警告可换行 |
| 列表列 | 必保留：□、热词、主术语；可选隐藏：别名、领域、备注、更新（进抽屉详情） |
| 检视器 | **无** 右侧常驻栏；点击行或「添加词条」→ **底部抽屉**（推荐）或全屏 overlay（二选一，Stitch 先出抽屉稿） |
| 抽屉高度 | 默认 **min 45vh / max 85vh**；可拖拽 handle 调高（实现 P2；Stitch 画 **展开态 70vh** 即可） |
| 抽屉遮罩 | `bg-notion-bg/60` + `backdrop-blur-sm`；点击遮罩 = 取消（同检视器「收起」） |
| 纠错记忆分段 | 无 sticky 摘要；冲突 banner 仍在列表上；抽屉字段同桌面检视器 |
| 词表包分段 | 不画 Master–Detail；居中说明 + 两 Secondary 按钮（与 G8 桌面态同文案） |

**动线**

1. 窄屏默认只见列表 → 与桌面「列表优先」一致。  
2. 选中行 → 抽屉覆盖列表下半部，列表仍可见上半（上下文不丢）。  
3. 切换 segmented 项 → **关闭抽屉**并清空临时编辑态（防误存）。  
4. 键盘：Esc 关闭抽屉；Tab 焦点陷阱在抽屉内。

**G9 / G10 / G11 分工**

| Frame | 画布 | 内容 |
|-------|------|------|
| **G9** | 390×844 或 768×1024 | 词汇表分段 · 列表全宽 · **无抽屉** |
| **G10** | 同上 | 词汇表 · **底部抽屉展开**（编辑「制控」） |
| **G11** | 同上 | 纠错记忆分段 · 列表 + 抽屉新建记忆 |

---

## 12. Stitch 交付 Frame 清单

### 12.1 主舞台 Frame（桌面 ≥1024px）

| Frame | 名称 | 必含 |
|-------|------|------|
| **G1** | 转写词汇表 · 默认 | nav 选中 vocabulary；sticky 摘要；列表+空检视器；工具栏 |
| **G2** | 转写词汇表 · 选中编辑 | 行高亮；检视器填满；Flame on |
| **G3** | 转写词汇表 · 截断警告 | saffron 摘要；preview 折叠 |
| **G4** | 转写词汇表 · 推荐 banner | mine banner + 列表 |
| **G5** | 转写词汇表 · 批量 | 批量条 + 多选 |
| **G6** | 纠错记忆 · 默认 | nav memory；列表+空检视器 |
| **G7** | 纠错记忆 · 冲突 | 冲突 banner + 采纳行 |
| **G8** | 词表包 | nav bundle 或 ⋯ 菜单态 |

**画布建议**：主 Frame 逻辑宽 **1200×800**（欢迎主舞台）；对照 HTML 为 1180 宽。

### 12.2 窄屏 Frame（<1024px，必出）

| Frame | 名称 | 必含 |
|-------|------|------|
| **G9** | 窄屏 · 词汇表列表 | 顶部分段选中「转写词汇表」；sticky 摘要；全宽表；**无抽屉** |
| **G10** | 窄屏 · 词汇表抽屉 | G9 基础上 + 遮罩 + bottom sheet（编辑态，字段与 G2 检视器一致） |
| **G11** | 窄屏 · 纠错记忆 | 分段选中「纠错记忆」；列表 + 抽屉（新建或编辑一行） |

### 12.3 浮动对话框 Frame（必出）

| Frame | 名称 | 必含 |
|-------|------|------|
| **G12** | 对话框 · 批量添加 | `CompactFloatingDialog` 叠加在 G1 语境上；见 §12.4 |
| **G13** | 工具栏 ⋯ 菜单（可选） | Dropdown：批量添加… / 从表格导入… / 导出 CSV |

**画布建议**：G12 对话框宽 **480px**，叠加在虚化后的 G1 背景上（表达 modal 语境）。

### 12.4 批量添加对话框（G12）规格

**真源**：现有 `GlossaryTermManagementSection` 批量区逻辑；v2 抽为 `GlossaryBulkAddDialog` + `CompactFloatingDialog`。

```
┌─ 批量添加 ─────────────────────────────────── [×] ─┐
│ 粘贴 Excel 选区（Tab 分列、换行分行）或逗号/顿号分隔；  │
│ 默认纳入热词。                                        │
├────────────────────────────────────────────────────┤
│ ┌─ textarea ─────────────────────────────────────┐ │
│ │ 香板                                          │ │
│ │ 提持                                          │ │
│ │ 上座                                          │ │
│ │                                               │ │
│ └───────────────────────────────────────────────┘ │
│ 11px meta：⌘↵ / Ctrl+Enter 快速提交（可选一行）       │
├────────────────────────────────────────────────────┤
│              [从表格导入…]  [取消]  [批量添加 ●]      │
└────────────────────────────────────────────────────┘
```

| 属性 | 值 | 说明 |
|------|-----|------|
| 组件 | `CompactFloatingDialog` | 同 `LexiconBundleExportDialog` |
| `id` | `glossary-bulk-add-v1` | 实现用 |
| 标题 | **批量添加** | |
| `defaultWidth` | **480** | |
| `fallbackHeight` | **320** | |
| `estimatedFitHeight` | 300–360 | textarea 4 行 |
| `bounds` | minW 400 · maxW 520 · minH 280 · maxH 480 | |
| 正文 | `FloatingPanelDialogScroll` 或 Header+单 textarea | 勿把短说明塞进 scroll `flex-1` 撑高空白 |
| textarea | `CONTROL_TEXTAREA` · `min-h-[120px]` · `rows={5}` | 主输入 |
| 说明 | `PANEL_TYPOGRAPHY.meta` 一段 | placeholder 与说明二选一，避免重复 |
| 页脚 | `footerJustify="end"` | 左：Secondary「从表格导入…」+ FileSpreadsheet 图标；右：Secondary「取消」+ Primary「批量添加」 |
| Primary 禁用 | `bulkPaste` 为空 | |
| 成功 | 关闭对话框 + 列表刷新 + 可选 toast | Stitch 不需画 |

**与 G5 批量条区分**

- **G5**：列表多选后的 **批量条**（纳入热词/删除），在页面内。  
- **G12**：**粘贴导入** 对话框，从工具栏 ⋯ 或「批量添加…」打开。  
- 两者 **不可** 合并为一个 Frame。

**错误态（实现；Stitch 可选 G12b）**

- 解析失败：textarea 下 cinnabar 一行。  
- `busy`：Primary 文案「添加中…」+ disabled。

---

## 13. 示例文案（中文 UI，可作 placeholder）

### 页头

- 标题：**热词与记忆**
- 副标题：**转写词汇表（Custom Vocabulary）**：只收录希望听成的正形，纳入热词后在下次 ASR 拉取时提交。**纠错记忆**：错→对，用于改正建议与编辑内规则，错形不会进入转写热词。

### 携带摘要

- 主行：**自动转录时将提交 12 个热词（12 条已纳入词条）**
- 空：**当前无词条纳入热词（0 个 token），下次转写不会携带术语表偏置。**

### 表格数据（示例）

| 热词 | 主术语 | 别名 | 领域 | 备注 |
|------|--------|------|------|------|
| 🔥 | 上座 | — | — | 纳入记忆时加入转写词汇表 |
| 🔥 | 制控 | — | — | 纠错记忆 3 次命中后自动加入 |
| ○ | 午禅 | — | — | — |

### 纠错记忆

| 错词 | 正词 | 命中 | 状态 |
|------|------|------|------|
| 乡版 | 香板 | 3 | 已采纳 |
| 叠幅 | 迭复 | 1 | 学习中 |
| 质控 | 制控 | 6 | 已稳定 |

---

## 14. Stitch 提示词（复制用）

### 14.1 英文（主提示）

```text
Redesign the "Hotwords & Memory" (热词与记忆) settings page for a desktop transcription app (Notion Zen design system).

Context:
- Full-page view inside a welcome hub (left app sidebar already exists—do NOT redesign global sidebar).
- Two mental models MUST stay separate: (1) Custom Vocabulary / hotwords for NEXT transcription, (2) Correction Memory wrong→right for CURRENT draft editing.
- Match the Environment panel pattern: inner left nav 192px + right scrollable workspace.

Layout v2:
- Page header: icon + title + one-line subtitle.
- Inner nav (3 items): 转写词汇表 (BookOpen), 纠错记忆 (Sparkles), 词表包 (FileSpreadsheet).
- Selected nav: notion-sidebar-active + 4px saffron left bar.

Workspace "转写词汇表":
- Sticky top strip: "本次转写将携带" summary (12 words · 37 chars / 12000 cap).
- Master-detail split: left 58% searchable term table, right 42% inspector panel.
- Toolbar: filter, search, refresh icon, primary "添加词条", overflow menu for bulk add / CSV.
- Table: checkbox, flame hotword toggle, term, alias, domain, note, updated, delete on row hover only.
- Inspector: empty state OR create/edit form (white card, 1px border, 6px radius).

Workspace "纠错记忆":
- Same master-detail pattern.
- Conflict banner on top when duplicate wrong forms exist.
- Table: wrong, right, hit count, status badge (已采纳/学习中/已稳定).

Design tokens: white bg, notion-sidebar #f7f7f5, dividers #e3e2e0, text #37352f, primary saffron #C58A43, danger cinnabar #963530. Buttons 32px height, 4px radius. No drop shadows on cards. Max 2 visible border layers on nesting path.

Deliver frames G1–G8 (desktop), G9–G11 (narrow <1024px), G12 (bulk-add dialog) per attached spec. Use attached HTML layout as proportion reference.

Narrow layout: replace left nav with top segmented control (转写词汇表 | 纠错记忆 | 词表包). Inspector becomes bottom sheet with drag handle, semi-transparent backdrop.

Bulk-add dialog (G12): CompactFloatingDialog 480px wide, title「批量添加」, large textarea, footer: 从表格导入 / 取消 / 批量添加 (primary). Overlay on blurred G1.
```

### 14.2 中文（补充）

```text
在欢迎页主舞台内重设计「热词与记忆」，参照环境与 LLM 面板的左导航+右内容，不要做成单列长滚动。
转写词汇表与纠错记忆是两个工作区，用页内左导航切换（桌面）；窄屏<1024px 改为顶部分段控件。
转写词汇表首屏必须是术语列表；携带摘要做 sticky 顶条；桌面编辑在右侧检视器，窄屏用底部抽屉。
批量添加用独立浮动对话框 G12（CompactFloatingDialog），不要占主布局首屏。
请出 G1–G8 桌面 Frame + G9–G11 窄屏 Frame + G12 批量添加对话框；比例对照 stitch-glossary-page-layout.html。
遵循 DESIGN.md Notion Zen：白底、细边框、saffron 主按钮、列表行操作 hover 才显示。
```

---

## 15. 上传 Stitch 组合

```text
01-DESIGN.md
apps/desktop/docs/stitch-glossary-page-spec.md  → 复制为 docs/stitch-upload/25-stitch-glossary-page-spec.md
apps/desktop/stitch-glossary-page-layout.html   → 复制为 docs/stitch-upload/26-stitch-glossary-page-layout.html
```

刷新命令：

```bash
bash scripts/prepare-stitch-upload.sh
open apps/desktop/stitch-glossary-page-layout.html
```

---

## 16. 定稿后回写清单（实现阶段）

| 优先级 | 文件 | 改动 |
|--------|------|------|
| P0 | `GlossaryPage.tsx` | 页内 nav + workspace 路由态 |
| P0 | `glossary/GlossaryWorkspaceShell.tsx`（新） | 左 nav + 右 slot |
| P1 | `GlossaryVocabularyWorkspace.tsx`（新） | Master–Detail |
| P1 | `GlossaryMemoryWorkspace.tsx`（新） | Master–Detail |
| P2 | `GlossaryBulkAddDialog.tsx`（新） | 批量从 section 抽出 |
| P2 | `useGlossaryPageController.ts` | `workspaceId` + 检视器选中态 |

验收：`hot-ux-hand-test-checklist.md` + `npm run typecheck && npm run test`.

---

## 17. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-06-12 | 初稿：Layout v2 Master–Detail + 环境页式 nav |
| 2026-06-12 | 补充 §11.1 窄屏 G9–G11、§12.3–12.4 批量添加对话框 G12 |

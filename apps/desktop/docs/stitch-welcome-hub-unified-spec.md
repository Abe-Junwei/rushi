# 欢迎页 × 项目 Hub — 统一重设计 Stitch 需求文档

> **版本**：2026-06-07  
> **真源**：仓库根 [`DESIGN.md`](../../../DESIGN.md)（Notion Zen）  
> **代码落位**：`WelcomeView.tsx` · `WelcomeSidebar.tsx` · `ProjectFilesHubPanel.tsx` · `EmptyProjectPanel.tsx` · `CreateProjectModal.tsx`  
> **静态对照**：[`stitch-welcome-hub-layout.html`](../stitch-welcome-hub-layout.html)  
> **关联旧稿**：[`stitch-welcome-page-spec.md`](./stitch-welcome-page-spec.md)（阶段 A/B 已过时，以本文为准）

---

## 0. 设计目标

| 目标 | 说明 |
|------|------|
| **视觉同族** | 欢迎页主舞台与编辑器内「项目文件 Hub」使用同一套 **Stage Card（工作区卡片）** 语言，用户从建项 → 选文件不应感到跳转到另一种产品 |
| **Notion Zen** | 白底、细边框、背景色差分层；saffron 仅用于主 CTA 与「打开」链接；禁止大面积空白漂浮控件 |
| **信息密度适中** | 单卡片承载主任务；列表行可扫读；导入与文件列表在同一视觉单元内 |
| **可落地** | 所有颜色/圆角/按钮高以 `tailwind.config.js` + `controlStyles.ts` 为准，Stitch 稿不得引入未入库 hex |

**不做什么**

- 不在本薄片改编辑页波形/语段区（见 `stitch-work-page-spec.md`）
- 不把 Hub 做成 Notion 全宽「裸页面」（无容器的大标题 + 散列表）
- 不新增第三套卡片样式（欢迎/Hub/空项目必须共用 Stage Card）

---

## 1. 成熟方案对照（调研摘要）

| 产品 | 文件/项目入口 | 可复用点 | 不采纳 |
|------|----------------|----------|--------|
| **Notion** | 首页 DB 卡片 + 左栏 | 居中列宽 ~708px、hover 行、ghost 操作 | 全宽无框首页（在本应用显得空） |
| **Descript** | 右侧 Project 面板 Files + Upload | 导入与列表同区、文件名 + 类型 | 侧栏内嵌（Rushi Hub 是主舞台选文件步） |
| **Rushi 现状** | 欢迎「最近文件」卡片 + Hub Stage Card | **已有行样式与 saffron 顶条** | 欢迎 hero 居中孤立、Hub 与欢迎间距/结构不一致 |

**决策**：以 Rushi 代码中渐趋统一的 **Stage Card + FileRow** 为母版，欢迎页主区收束为同构卡片，而非另起 Notion 裸页。

---

## 2. 共享母版：Stage Card（工作区卡片）

两页主舞台中央均为 **一张** Stage Card，水平居中；视口高度 ≥640px 时 **垂直居中**（矮窗口顶对齐，防裁切）。

### 2.1 尺寸与壳层

| 属性 | 值 | Tailwind / CSS |
|------|-----|----------------|
| 最大宽度 | 672px | `max-w-2xl` |
| 水平内边距（舞台） | 24–40px | `px-6 sm:px-10` |
| 卡片圆角 | 6px | `rounded-md` |
| 外边框 | 1px | `border-notion-divider` |
| 卡片底 | 白略透 | `bg-notion-bg/80` |
| 顶强调条 | 高 4px，saffron 70% | `absolute top-0 inset-x-0 h-1 bg-zen-saffron/70` |
| 可见 border 层数 | **仅卡片外壳 1 层** | 内部分区用 `border-t` 发丝线，不再套带 border 的容器 |

### 2.2 三段结构（Header / Body / Footer）

```
┌─ saffron 顶条 ─────────────────────────────────────┐
│ HEADER  px-20–24 py-16                           │
│  [图标]  标题 + 副文案          [项目操作组]        │
├──────────────────────────────────────────────────┤
│ BODY    px-20–24 py-16                           │
│  区块标题 + 计数                    [可选行内操作]  │
│  ┌ FileRow ──────────────────────────────────┐   │
│  ├ FileRow ──────────────────────────────────┤   │
│  └ …                                         ┘   │
├──────────────────────────────────────────────────┤
│ FOOTER  bg-notion-sidebar/50  border-t           │
│  LABEL「继续导入」或「导入资源」                    │
│  [Secondary 导入音频] [Secondary 导入文本]        │
└──────────────────────────────────────────────────┘
```

| 分区 | 背景 | 分隔 |
|------|------|------|
| Header | 默认白 / 或 `bg-notion-sidebar/50` | 底 `border-t notion-divider` |
| Body | 白 | 无额外框 |
| Footer | `notion-sidebar/50` | 顶 `border-t` |

---

## 3. 共享组件：FileRow（文件行）

欢迎页「最近文件」与 Hub「项目文件」**必须像素级同构**。

| 属性 | 值 |
|------|-----|
| 容器 | `rounded-lg border border-notion-divider bg-notion-bg` |
| 内边距 | `px-12 py-10`（Tailwind `px-3 py-2.5`） |
| Hover | `bg-notion-sidebar-hover` |
| 主文案 | `14px medium notion-text`，单行截断 |
| 次文案 | `11px notion-text-muted`：`{类型} · {月日} {时:分}` |
| 主操作 | 右侧 **「打开」** `11px semibold zen-saffron` |
| 次操作 | hover/focus 显示 `重命名` `删除` 图标按钮 28×28 |

**空态（Body 内）**

- 虚线框 `border-dashed`、居中文案 12px muted  
- 文案示例：「暂无最近文件，请先新建项目或导入文件。」

---

## 4. 页面 A — 欢迎页（Welcome Home）

**路由/状态**：`current == null`，`WelcomeView` `page === "home"`。

### 4.1 外壳（Stitch 整页 Frame 须包含）

```
┌──────────────┬────────────────────────────────────────────┐
│ Sidebar 320px│ TopBar 48px (h-12)                         │
│              ├────────────────────────────────────────────┤
│ 品牌 + 导航  │  [可选 ASR 错误条]                          │
│ 最近项目列表 │                                            │
│              │     ┌── Stage Card ──┐                     │
│              │     │  欢迎 + CTA    │  ← 垂直水平居中      │
│              │     │  最近文件      │                     │
│              │     └────────────────┘                     │
└──────────────┴────────────────────────────────────────────┘
```

- **Sidebar**：`WelcomeSidebar` — 宽 `20rem`，`notion-sidebar` 底 + 右 `border-divider`  
- **TopBar**：`WelcomeTopBar` — 右：ASR/LLM chip、搜索占位、通知、头像（**本薄片不改 TopBar 结构，仅保证与 Hub 同主舞台宽**）

### 4.2 Stage Card — 欢迎变体（Welcome Card）

| 区块 | 内容 | 与 Hub 差异 |
|------|------|-------------|
| **Header** | 左：无项目图标；**Serif** 标题「欢迎回来」32px medium；副文案 14px muted 居中或左对齐（**推荐左对齐与 Hub 对齐**） | Hub 用 Folder 图标 + Sans 项目名 |
| **Header 下** | 全宽主按钮区：`新建项目` Primary Prominent 40px 高，最大宽 320px | Hub 无此 CTA |
| **Body** | 标题行：saffron **Mic** 图标 +「最近文件」+ 右「N 个文件」 | 与 Hub「项目文件」对称 |
| **Body 列表** | FileRow × up to 8 | **同 FileRow** |
| **Footer** | **省略**（导入在「新建项目」模态完成） | Hub 保留 Footer 导入 |

> **统一性取舍**：欢迎页 Footer 不放导入，避免与「新建项目」重复；文件行与 Hub 100% 一致即可建立同族感。

### 4.3 欢迎页 Frame 清单

| ID | 名称 | 要点 |
|----|------|------|
| **W1** | Welcome · 有最近文件 | Sidebar 3+ 项目；Card 内 3 文件行 |
| **W2** | Welcome · 空最近文件 | Card Body 虚线空态 |
| **W3** | Welcome · ASR 错误 | Top 下红色引导条（现有 `AsrErrorBanner`） |
| **W4** | Welcome · 新建项目模态 | 模态叠在 W1 上（见 §7） |

---

## 5. 页面 B — 项目文件 Hub（Editor · File Hub）

**路由/状态**：`current != null`，`currentFileId == null`，有 ≥1 文件 → `ProjectFilesHubPanel`。

### 5.1 外壳

```
┌────────────────────────────────────────────────────────────┐
│ EditorToolbar 48px — 面包屑「项目名 / 选择文件」+ 环境入口    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│              ┌── Stage Card（Hub 变体）──┐                 │
│              │ Header 项目信息 + 操作    │                 │
│              │ Body  项目文件列表        │                 │
│              │ Footer 继续导入           │                 │
│              └──────────────────────────┘                 │
└────────────────────────────────────────────────────────────┘
```

- 无左侧 Sidebar（与欢迎页最大结构差异；**主卡片必须一致以承接用户心智**）

### 5.2 Stage Card — Hub 变体

| 区块 | 内容 |
|------|------|
| **Header** | 左：`FolderOpen` saffron 20px + **项目名** 18–20px semibold + 副文案（元信息 `讲述人 · 时间 · 地点` 或「选择下方文件进入转写与编辑」） |
| **Header 右** | **项目操作组**：浅底 `notion-sidebar/80` 圆角容器内 3 图标按钮 — 重命名 / 项目信息 / 删除 |
| **Body 标题** | 「项目文件」+ 右「N 个文件」 |
| **Body 列表** | FileRow（同 §3） |
| **Footer** | Label「继续导入」11px uppercase tracking；按钮 Secondary 32px：`导入音频` `导入转录文本` |

### 5.3 Hub Frame 清单

| ID | 名称 | 要点 |
|----|------|------|
| **H1** | Hub · 单文件 | 1 FileRow |
| **H2** | Hub · 多文件 + 元信息 | Header 副文案为元信息摘要 |
| **H3** | Hub · 重命名项目 | Header 内联 input 替换标题 |
| **H4** | Hub · 重命名文件 | 单行 FileRow 变 input |

---

## 6. 页面 C — 空项目（Empty Project）

**状态**：`current != null`，无文件 → `EmptyProjectPanel`。

与 Hub **共用 Stage Card 外壳 + saffron 顶条**，内容换为：

| 区块 | 内容 |
|------|------|
| Header | 居中 Folder 图标 +「暂无媒体文件」+ 说明文案 |
| Body | 两列 **Import Tile**（与现有空项目页相同：圆角边框卡片 + 图标圆底） |
| Footer | 拖放提示区（虚线/浅 sidebar 底） |

Stitch 需出 **E1** Frame，并标注与 H1 **壳层同宽同圆角**。

---

## 7. 叠加层 — 新建项目模态

| 属性 | 值 |
|------|-----|
| Preset | 392×290px 起，compact dialog |
| 结构 | 项目名称 → 一行 helper → 分隔「导入首个文件」→ 两列 secondary → Footer 取消 / 创建空项目 |
| 与 Stage Card 关系 | 模态居中；**不**在 Stitch 中把模态与 Card 画进同一 Frame（单独 Frame **M1**） |

---

## 8. 排版与颜色（Stitch 必遵）

| 元素 | 规格 |
|------|------|
| UI 字体 | Inter |
| 欢迎标题（唯一 Serif） | Noto Serif SC 32px — **仅 Welcome Header** |
| 项目/HUB 标题 | Inter 18–20px semibold |
| 区块 label | 11px medium uppercase tracking-wider muted |
| Primary | `#C58A43` saffron，40px（欢迎 CTA）/ 32px（模态） |
| Secondary | notion-sidebar 底 + hairline |
| 危险 | cinnabar 仅删除 hover |

图标：Lucide，stroke 2；SM 14 / MD 18 / LG 20。

---

## 9. 响应式

| 断点 | 欢迎页 | Hub |
|------|--------|-----|
| `<1024px` | Sidebar 折叠或上移（现有逻辑） | 全宽 Toolbar；Card `px-4` |
| `≥1024px` | Sidebar 320px 固定 | Card 居中 max-w-2xl |
| 高度 `<640px` | Stage 顶对齐 | 同 |
| 高度 `≥640px` | Stage 垂直居中 | 同 |

---

## 10. Stitch 出图 Frame 总表（建议 8 张）

1. **W1** — Welcome + Sidebar + Stage Card（有文件）  
2. **W2** — Welcome 空最近文件  
3. **H1** — Editor Hub 单文件  
4. **H2** — Hub 多元信息 + 多文件  
5. **E1** — Empty Project 同壳导入  
6. **M1** — Create Project Modal  
7. **Compare** — W1 与 H1 **并排**（同 FileRow 对齐标注）  
8. **Compare** — Stage Card 结构标注图（Header/Body/Footer）

静态 HTML 对照：[`stitch-welcome-hub-layout.html`](../stitch-welcome-hub-layout.html) 含 W1/H1/E1 三栏对照。

---

## 11. Stitch 提示词（英文 · 主）

```text
Design a desktop transcription app "Notion Zen" workspace. Two main screens must share the SAME centered "Stage Card" component (672px max width, 6px radius, 1px #e3e2e0 border, 4px saffron top accent bar, white background).

Screen 1 — Welcome (with 320px left sidebar in #f7f7f5):
- Main area: vertically and horizontally centered Stage Card.
- Card header: serif title "欢迎回来", muted subtitle, full-width saffron primary button "新建项目" (40px height).
- Card body: section "最近文件" with saffron mic icon, file count right; list of FileRow items (bordered rounded rows, filename + meta, saffron "打开" link on the right).
- No footer import on welcome card.

Screen 2 — Project File Hub (no sidebar, editor top bar with breadcrumb "Project / 选择文件"):
- Same Stage Card dimensions and styling as Welcome.
- Card header: saffron folder icon, project name (Inter semibold 20px), metadata subtitle, right icon cluster (rename, info, delete).
- Card body: "项目文件" section + same FileRow list as welcome.
- Card footer: light #f7f7f5 background, label "继续导入", two secondary buttons "导入音频" "导入转录文本".

FileRow must be pixel-identical on both screens. Plenty of whitespace but NO orphaned floating elements in empty canvas. Inter UI, warm saffron #C58A43 accents only on primary CTA and "打开". Restrained, professional, not playful.
```

---

## 12. Stitch 提示词（中文 · 备选）

```text
桌面转写应用，Notion Zen 风格。欢迎页与项目文件 Hub 必须共用同一「工作区卡片」：宽 672px、圆角 6px、1px 浅灰边框、顶部 4px 琥珀色强调条。

欢迎页：左侧 320px 浅灰导航 + 右侧主区居中卡片。卡片内：衬线标题「欢迎回来」、说明、主按钮「新建项目」、下方「最近文件」列表（带边框文件行 + 右侧「打开」）。

项目 Hub：无侧栏，顶栏面包屑。主区居中**同款卡片**。卡片头：文件夹图标 + 项目名 + 元信息 + 右侧操作图标；中部项目文件列表（文件行与欢迎页完全一致）；底部浅灰区「继续导入」+ 两个次要按钮。

两页文件行必须同构。空白区域不要乱散控件。Inter 为主，仅 CTA 与「打开」用 saffron #C58A43。
```

---

## 13. 验收清单（设计稿 / 回码）

- [ ] W1 与 H1 的 **FileRow** 宽、高、边距、字号一致（可叠加对齐检查）  
- [ ] 两页 Stage Card **同宽、同顶条、同圆角、同内边距**  
- [ ] 欢迎页不再使用「仅居中 hero + 20px 间距 + 独立第二卡片」的割裂布局  
- [ ] Hub 不在白底上单独漂浮无框标题  
- [ ] 卡片内仅 **1 层** 外边框；列表行自带 border，不再套第三层容器 border  
- [ ] Footer 导入仅 Hub/Empty；欢迎页导入走模态  
- [ ] 色值全部可在 `DESIGN.md` / tailwind 主题找到  
- [ ] 出图含 **W1/H1 并排对照** Frame  

---

## 14. 回码落位预告（Stitch 定稿后）

| 变更 | 文件 |
|------|------|
| 抽取 `StageCard` / `FileRow` 共享组件 | `apps/desktop/src/components/workspace/`（新建） |
| 欢迎主区改用 Stage Card | `WelcomeView.tsx` |
| Hub 已部分符合 | `ProjectFilesHubPanel.tsx` 微调间距 |
| 空项目壳层对齐 | `EmptyProjectPanel.tsx` |
| 样式 | `workspace.css` — `.project-files-hub-stage` / welcome 主区共用 `.workspace-stage-centered` |

验证：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

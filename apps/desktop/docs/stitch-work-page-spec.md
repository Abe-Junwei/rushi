# P1 校对工作页 — Stitch 重设计说明

本文描述 **已打开项目**（`current != null`）时的界面，对应代码 **`workspacePhase === "C"`**。包含：**左轨（项目 / 新建另一项目 / 术语库 / 诊断）**、**主区工具条**、**转写提示**、**波形 + 时间轴语段列表**、**底栏**、**忙碌遮罩**。欢迎页说明见同目录 [`stitch-welcome-page-spec.md`](./stitch-welcome-page-spec.md)。

实现参考：[`src/components/ProjectPanel.tsx`](../src/components/ProjectPanel.tsx)（`workspacePhase === "C"` 分支、`TIMELINE_PX_PER_SEC`、`useProjectWaveform`）。

---

## 1. 用户目标

- 从本机 ASR **拉取/刷新语段**，编辑时间与文本，**保存到 SQLite**。
- **播放**音频并对照 **波形** 与 **时间对齐的语段条**。
- **导出**多种格式；**拆分/合并**语段；必要时**删除整个项目**。
- 维护 **术语库**（影响下次拉取时的 hotwords）。

---

## 2. 信息架构（工作页专用）

在「外壳」之下（顶栏、全局错误、环境面板与欢迎页相同），**工作区**为左右分栏：

```
┌──────────────────┬──────────────────────────────────────────────┐
│ 左轨（Aside）     │ 主区（Main）                                  │
│ · 项目           │ · 工具条（项目名、操作按钮两行）               │
│ · 新建另一项目    │ · [可选] transcribeHints 横幅                 │
│ · 术语库         │ · 波形区（sticky 顶）+ 横向滚动容器             │
│ · 诊断           │ · 语段行列表（每行：左文右时间轨色块）          │
│                  │ · 底栏提示                                     │
└──────────────────┴──────────────────────────────────────────────┘
```

- **主区根节点**：`flex flex-col flex-1 min-h-0`，保证最大化时 **中间波形滚动区吃掉剩余高度**。
- **左轨**：`lg` 下固定宽度；内容多时可 **独立纵向滚动**。

---

## 3. 设计令牌

与欢迎页相同，见 [`stitch-welcome-page-spec.md`](./stitch-welcome-page-spec.md) 第 3 节。工作页额外强调：

- **波形条背景**：深色条（实现为 `bg-zen-ink`），上为 **WaveSurfer 画布**（固定高度约 `6rem`），下为 **播放控制行**（白半透明文字）。
- **语段行**：浅分割底边；**选中**行浅 saffron 底；**低置信**行浅 ochre 底（与选中叠加时优先可读性）。

---

## 4. 左轨（Aside）— 仅阶段 C

自上而下四块，块间距统一（如 `space-y-4`）。

### 4.1 项目（与欢迎相同）

- 下拉 `打开已有项目…` + `刷新`  
- `busy` 时禁用

### 4.2 新建另一项目

| 元素 | 说明 |
|------|------|
| 标题 | `新建另一项目` |
| 项目名称 | 单行输入 |
| `选择音频…` | Secondary |
| `创建项目` | Primary，`pickedPath` 为空时 `disabled` |
| 已选路径 | `10px` mono、`zen-indigo`、`break-all`（有路径才显示） |

说明：用户在已打开项目 A 时仍可建项目 B；创建成功后界面切到新项目。

### 4.3 术语库

| 元素 | 说明 |
|------|------|
| 说明 | `拉取语段时一并提交 hotwords（空格拼接）。` |
| 错误 | 术语控制器错误时红字 |
| 输入 | placeholder `输入术语…`；Enter 提交 |
| `添加` | Secondary |
| 列表 | `max-h` 约 `10rem` 可滚动；每项术语 + `删除` |

`gl.busy` 或 `c.busy` 时禁用输入/按钮。

### 4.4 诊断

- 单按钮 Secondary：`导出诊断包（zip）`

---

## 5. 主区 — 工具条（两行）

### 5.1 第一行：项目身份 + 说明

| 元素 | 内容 |
|------|------|
| 标题行 | **项目名**（`font-medium`）+ ` · ` + **短 ID**（`id` 前 8 位 + `…`，mono、`zen-indigo`） |
| 说明 | `横向滚动查看全长；左侧为文本与时间，右侧色块与上方波形同一像素标尺对齐。`（`10px`、`zen-stone`、居中） |

### 5.2 第二行：主操作 + 导出 + 项目菜单

| 控件 | 类型 | 文案 / 选项 | 备注 |
|------|------|-------------|------|
| 拉取语段 | Primary | `从 ASR 拉取语段` | 旁可有静态小字「（可能需数分钟）」 |
| 保存 | Primary | `保存到 SQLite` | |
| 撤销 | Secondary | `撤销一步` | |
| 导出 | `<select>` 伪装成按钮风格 | 占位 `导出…`；`TXT` / `SRT` / `DOCX 逐字稿` / `DOCX 讲稿` | 选后执行并重置占位 |
| 项目菜单 | `<details>` | Summary：`项目…`；菜单内 **删除项目**（红字、hover 浅红底） | 点击删除前有 **浏览器 confirm**（设计可改为应用内 Modal） |

### 5.3 第三行：编辑操作

| 按钮 | 文案 | `disabled` |
|------|------|------------|
| 拆分 | `拆分当前语段` | `busy` |
| 合并 | `与下一条合并` | `busy` 或当前为最后一条 |

---

## 6. 转写提示条（可选显隐）

**条件**：`transcribeHints.length > 0`（拉取语段返回后的启发式提示）。

| 属性 | 建议 |
|------|------|
| 位置 | 紧挨工具条下方，**全宽** |
| 样式 | 浅 ochre 底、`12px`、`zen-indigo`、列表项逐条 |

---

## 7. 波形与时间轴核心区

### 7.1 外层滚动容器

- 占主区 **剩余高度**（`flex-1 min-h-0`）。
- 内层：`overflow: auto`，圆角、细边框、浅阴影（「内凹」工作区）。
- **内部轨道宽度**：`timelineWidthPx` = `f(duration, segments) * 56`，上下限约 `320px～16000px`（实现常量 **`TIMELINE_PX_PER_SEC = 56`**，与 WaveSurfer `minPxPerSec` 一致）。

### 7.2 Sticky 波形条（宽 = 轨道宽）

| 子区域 | 说明 |
|--------|------|
| 错误 | 若有加载错误，黄杏色小字条 |
| 波形 | 固定高度容器挂载 WaveSurfer；**整轨宽度 = 上式** |
| 控制行 | 左：**播放/暂停**（圆按钮）；中：**当前时间 / 总时长** mono；右：一句「波形与下方色块同一水平标尺」 |

深色条与浅色主区对比要强，便于聚焦时间轴。

### 7.3 语段列表（每行一条 segment）

**行结构**：横向 flex，**整行可点右侧轨** → seek 到该段并选中。

| 左 gutter（sticky left） | 右轨 |
|--------------------------|------|
| 固定宽约 `min(17rem, 40vw)`，`max-w 20rem`，浅底+右阴影，**竖向与波形标尺同源** | `flex-1`，相对定位；内层 **绝对定位色块** 表示 `[start_sec, end_sec]` |

**左 gutter 内容（上→下）**

1. 行号 `#n` + 置信展示 / `低置信` 徽章  
2. 两列数字输入：`开始 s` / `结束 s`（`step 0.01`）  
3. `textarea` 正文：`font-serif`、`13px`、略大行高  

**右轨色块**

- 水平位置：`left = start_sec * 56`，`width = max((end_sec - start_sec) * 56, 8)` px  
- 样式：**选中** → 较深 saffron 透明底+边；**未选** → 浅 saffron；**低置信** → ochre 系（与选中并存时设计需可读）

**空语段列表**

居中灰字：`尚未有语段：请先「从 ASR 拉取语段」。`

### 7.4 无音频预览 URL

若 `audioSrc` 为空（非 Tauri 等）：主区显示说明：`无法生成音频预览 URL（仅 Tauri 壳内可用）。`

---

## 8. 底栏（Footer）

| 元素 | 文案 |
|------|------|
| 提示 | `双击波形语段仅播该段 · 修改后请保存` |

`shrink-0`，浅顶边，与波形区分离。

---

## 9. 忙碌遮罩（工作页）

与欢迎页相同机制：覆盖 **整个 `main`**（含工具条与波形），`z-index` 高于内容。

- 转写中：`正在从 ASR 拉取语段` + 「数分钟」类提示  
- 保存中：`正在保存到 SQLite`  
- 波形区域在 `busy` 时可 **降低透明度 + 禁用指针**（防与结果打架）

---

## 10. 响应式

- **`lg` 以下**：侧栏在上、主区在下；波形区高度仍应占满「主区扣掉工具条」后的空间。  
- **`lg` 以上**：左右分栏同高；侧栏固定宽，主区 `flex-1`。

---

## 11. 交互摘要（供原型连线）

| 操作 | 结果 |
|------|------|
| 拉取语段 | `busy` → 遮罩；完成后刷新 `segments` 与 `transcribeHints` |
| 保存 | `busy` → 遮罩；完成后重载项目 |
| 点右侧轨 | `seek(start)` + 选中该行 |
| 波形 region 拖拽 | 提交边界更新（由 hook 处理） |
| 导出下拉 | 选格式即导出，不常驻选中项 |

---

## 12. 给 Stitch 的提示词片段（可复制）

> Desktop transcription review workspace, same warm zen palette as before (#F2EFE8 paper, #2C2C2C ink, #C58A43 saffron accent). Two-column layout on large screens: narrow left rail (project switcher, secondary “new project”, glossary list, diagnostics). Main column: top toolbar two rows (project title + id, primary actions Transcribe/Save, export dropdown, overflow menu for delete), optional amber hint strip, then a large scrollable panel. Inside: sticky dark header strip containing audio waveform + transport (play/pause, timecode). Below, vertical list of segment rows: each row left sticky panel with segment index, confidence, numeric start/end fields, serif transcript textarea; right side a wide horizontal timeline track with a colored bar positioned by time (56px per second), bars align with waveform. Subtle row selection highlight. Serious, calm, Buddhist editorial mood—not gamified.

---

## 13. 验收清单（设计稿应对齐）

- [ ] 主操作与危险操作分离：**删除**不在主按钮行并列。  
- [ ] **时间维度**：波形与语段条 **同一像素比例**（设计稿可标注 56 px/s）。  
- [ ] **长音频**：横向滚动容器明显可发现（滚动条或边缘渐变）。  
- [ ] **选中与低置信** 同时存在时的对比度。  
- [ ] 最大化时：**主列表区域可伸展**，底栏与工具条不挤出视口（flex 分配合理）。

# P1 欢迎与建项流程 — Stitch 重设计说明

本文描述 **无已打开项目**（`current == null`）时用户看到的界面，对应代码中的 `**workspacePhase === "A"`**（冷启动）与 `**workspacePhase === "B"**`（已选音频、待确认创建）。顶栏、环境与 ASR 折叠区、左轨在两阶段**共用**；主舞台在 A / B 之间切换。

实现参考：`[src/components/ProjectP1Panel.tsx](../src/components/ProjectP1Panel.tsx)`（`workspacePhase`、`showAsrBanner`、主区 A/B 分支）。

---

## 1. 用户目标与心智模型


| 阶段    | 用户目标                                  |
| ----- | ------------------------------------- |
| **A** | 快速「新建」或「打开」项目；了解 ASR 是否可用；必要时进入环境与排障。 |
| **B** | 确认所选音频与项目名称无误后创建项目；可改选文件或取消回到 A。      |


**不在欢迎页出现的内容**：波形、语段列表、导出、术语库（术语仅在工作页侧栏出现）。

---

## 2. 全局信息架构（欢迎 + 工作共用外壳）

以下为 **P1 面板根容器**（`section`）自上而下的区块顺序，欢迎页与工作页一致，仅主舞台不同。

```
┌─────────────────────────────────────────────────────────────┐
│ 顶栏：品牌文案 | ASR 状态点阵 | [环境与 ASR] | (宽屏) ASR URL │
├─────────────────────────────────────────────────────────────┤
│ [可选] 全局错误条（红框，跨阶段）                              │
├─────────────────────────────────────────────────────────────┤
│ [可选] ASR 不可达横幅（仅 A 阶段 + asrHealth===error）       │
├─────────────────────────────────────────────────────────────┤
│ [可选] 环境与 ASR 折叠内容区（可滚动，有 max-height）         │
├──────────────────┬──────────────────────────────────────────┤
│ 左轨（Aside）     │ 主舞台（Main）← A 或 B 在此切换           │
│                  │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

- **根容器**：全高 flex 列、`overflow-hidden`、圆角卡片、浅底 `zen-paper`、细边框、轻阴影。
- **顶栏**：`shrink-0`，底部分割线；左侧可换行；右侧「环境与 ASR」为切换按钮（非路由）。
- **环境与 ASR**：展开时占用 **纵向可变高度**，内部可滚动；**不要**默认展开，以免淹没欢迎主 CTA。

---

## 3. 设计令牌（与实现对齐）

Tailwind 扩展色（`[tailwind.config.js](../tailwind.config.js)`）：


| Token          | Hex       | 用途          |
| -------------- | --------- | ----------- |
| `zen-ink`      | `#2C2C2C` | 主标题、正文强调    |
| `zen-paper`    | `#F2EFE8` | 面板背景        |
| `zen-saffron`  | `#C58A43` | 主按钮填充、选中态点缀 |
| `zen-ochre`    | `#EAE0C5` | 提示条背景、低置信辅助 |
| `zen-stone`    | `#8E8E8E` | 次级标签、说明文    |
| `zen-cinnabar` | `#963530` | 错误、危险操作文字   |
| `zen-indigo`   | `#3D4F5D` | 等宽路径、技术信息   |


**字体**：正文 UI 为系统无衬线；语段正文在工作页用衬线（欢迎页主文案当前为无衬线小标题）。全局可选 `Noto Serif SC` 用于庄重感（见 `index.html`）。

**按钮（逻辑两类）**

- **Primary**：`zen-saffron` 底、白字、圆角、`text-xs`、hover 略透明。
- **Secondary**：白半透明底、浅灰边、`zen-ink` 字、hover 边/字偏 saffron。

**输入框**：白底、浅边框、小字号、`focus` 时边 + ring 偏 saffron。

---

## 4. 顶栏（欢迎 / 建项 / 工作共用）


| 元素      | 文案 / 行为                                                     | 状态                          |
| ------- | ----------------------------------------------------------- | --------------------------- |
| 品牌      | `如是我闻 · 本地校对`；`11px`、字间距宽、`zen-stone`                       | 常显                          |
| ASR 检测中 | `正在检测 ASR…`                                                 | `asrHealth === "checking"`  |
| ASR 正常  | 三列：`FFmpeg` / `FunASR` / `转写就绪`，每列前 **2px 圆点**（绿=ok，红=fail） | `asrHealth === "ok"` 且有能力对象 |
| ASR 异常  | `ASR 不可达`，`zen-cinnabar`                                    | `asrHealth === "error"`     |
| 环境与 ASR | 收起：`环境与 ASR`；展开：`收起环境与 ASR`                                 | `aria-expanded` 与面板同步       |
| ASR 基址  | `asrBaseUrl()` 等宽截断                                         | **仅 `lg:` 及以上**显示           |


---

## 5. 仅欢迎流程：ASR 横幅（阶段 A）

**显示条件**：`workspacePhase === "A"` **且** `asrHealth === "error"`。


| 元素  | 内容                          |
| --- | --------------------------- |
| 说明  | `无法连接本机 ASR，请检查服务是否在运行。`    |
| 操作  | 次要按钮：`打开环境与 ASR`（将环境面板设为展开） |


视觉：浅红底边框，与全局错误条区分（横幅更偏「引导」）。

---

## 6. 左轨（Aside）— 阶段 A / B

两阶段侧栏结构相同；**不**展示「术语库 / 诊断 / 新建另一项目」（这些仅 `workspacePhase === "C"`）。

### 6.1 区块「项目」


| 控件         | 说明                                                           |
| ---------- | ------------------------------------------------------------ |
| `<select>` | 占位选项：`打开已有项目…`；选项为所有项目：`{name} ({本地化日期时间})`；选后触发加载并清空 select |
| 按钮 `刷新`    | 重新拉取项目列表                                                     |


**窄屏**：侧栏在主区**上方**，底部分割线与主区分隔。  
`**lg+`**：侧栏在左，固定宽度约 `min(16rem, 28vw)`、`max-w 18rem`，**右边框**与主区分隔；纵向可 `overflow-y: auto`。

### 6.2 辅助说明（非 C 时）

文案：

> `新建项目请使用主区「选择音频」；打开项目请使用上方下拉或最近列表。`

---

## 7. 主舞台 — 阶段 A（冷启动欢迎）

**布局**：垂直 flex，`flex-1`，内容垂直居中为主，整体可 `overflow-y: auto`（小屏或展开环境后仍可达主按钮）。

### 7.1 标题区


| 元素  | 样式提示                                               | 文案                                         |
| --- | -------------------------------------------------- | ------------------------------------------ |
| 标题  | `text-sm`、`font-medium`、`zen-ink`                  | `开始校对`                                     |
| 副文案 | `12px`、`leading-relaxed`、`zen-stone`、`max-w-md` 居中 | `选择本地音频创建项目，或打开已有 SQLite 项目。ASR 需在另一终端运行。` |


### 7.2 主 CTA


| 按钮   | 类型      | 文案           | `disabled` |
| ---- | ------- | ------------ | ---------- |
| 新建入口 | Primary | `新建项目（选择音频）` | `busy` 时   |


点击后打开系统文件选择器；选中后进入 **阶段 B**（未点创建前 `current` 仍为 null）。

### 7.3 最近项目


| 元素   | 说明                                                                           |
| ---- | ---------------------------------------------------------------------------- |
| 区块标题 | `最近项目`；`11px`、uppercase、tracking、`zen-stone`、居中                              |
| 列表容器 | 圆角边框、浅底；`max-h: min(24rem, 50vh)`，内部滚动                                       |
| 每行   | 整行可点按钮：左 **项目名**（粗体、可截断），右 **日期**（`10px` mono、`zen-stone`）；hover 浅 saffron 底 |
| 空态   | 居中 `12px` `zen-stone`：`暂无项目，请先新建。`                                           |


数据：最多 **8** 条，按 `updated_at_ms` **降序**。

---

## 8. 主舞台 — 阶段 B（确认建项）

**布局**：同 A，居中卡片；可纵向滚动。

### 8.1 卡片（建议 Stitch 作为独立 Card 组件）


| 字段   | 说明                                                              |
| ---- | --------------------------------------------------------------- |
| 卡片标题 | `确认创建项目`；`text-sm`、`font-medium`、居中                             |
| 标签   | `音频文件`                                                          |
| 主文件名 | `pickedBasename`（从路径取最后一段），`12px` mono、`zen-indigo`、`break-all` |
| 完整路径 | `10px` mono、`zen-stone`、可很长需换行                                  |
| 项目名称 | `label` + 单行 `input`，绑定默认「未命名项目」等                               |
| 主按钮  | Primary：`创建项目`                                                  |
| 次按钮  | Secondary：`重新选择音频`                                              |
| 次按钮  | Secondary：`取消`（清除已选路径，回 A）                                      |


---

## 9. 全局阻塞层（欢迎 / 建项也会出现）

当 `busy === true` 时，**主舞台区域**（`main`）上叠一层 **绝对定位全屏**遮罩（半透明 + 轻 blur），**不**隐藏底层结构以便感知上下文。


| 元素   | 说明                                                         |
| ---- | ---------------------------------------------------------- |
| 标题   | 依 `busyReason`：`正在创建项目` / `正在加载项目` / `正在执行安装脚本` / 默认 `处理中` |
| 副标题  | 如「完整识别可能需数分钟」仅转写；创建/保存等各有短说明                               |
| 不定进度 | **非真实百分比**：细条形容器 + 约 1/3 宽度 **pulse** 色块（`zen-saffron`）    |
| 计时   | `已等待 {n}s`，mono、`11px`                                     |


安装 FunASR 依赖时也会 `busy`，欢迎页仍可能被盖住。

---

## 10. 响应式摘要


| 断点     | 行为                        |
| ------ | ------------------------- |
| `< lg` | 侧栏在上、主区在下；顶栏换行；ASR URL 隐藏 |
| `≥ lg` | 侧栏在左、主区在右同高拉伸；ASR URL 显示  |


---

## 11. 给 Stitch 的提示词片段（可复制）

**欢迎（阶段 A）**

> Desktop productivity app, calm Buddhist-inspired palette: warm paper background #F2EFE8, ink text #2C2C2C, saffron accent #C58A43 for primary CTA, muted stone #8E8E8E for secondary text. Centered empty state: title「开始校对」, short subtitle about local SQLite projects and ASR. One primary button「新建项目（选择音频）」. Below, section「最近项目」: list of up to 8 rows, project name left, date right, subtle list card with border. Left sidebar (wide screens): narrow rail with project dropdown + refresh + hint text. Top bar: small caps brand, three status dots FFmpeg/FunASR/转写就绪, tertiary button「环境与 ASR」. No waveform. Restrained, plenty of whitespace, not playful.

**确认建项（阶段 B）**

> Same visual system. Centered modal-like card (not full modal): title「确认创建项目」, show audio basename and full path in monospace, project name field, primary「创建项目」, secondary「重新选择音频」and「取消」. Same top bar and left rail as welcome.

---

## 12. 验收清单（设计稿应对齐）

- 默认主路径清晰：**一个主 CTA** + 最近项目 + 侧栏打开项目。
- ASR 异常时：**横幅**不依赖用户发现顶栏小字。
- 环境面板：**默认收起**；展开时有独立滚动与高度上限。
- 阶段 B 与 A **视觉层级**区分（卡片 vs 平铺欢迎）。
- `busy` 时：**全主区遮罩** + 文案与计时，侧栏项目切换应禁用（与实现一致）。


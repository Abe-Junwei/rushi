# Rushi（如是我闻本地版）

本地中文课音频转写与校对桌面应用（Tauri + React + SQLite + Python ASR 侧车）。本文件是**领域词汇表**——只定义叫什么、避免叫什么；实现细节见 `docs/architecture/`，决策见 `docs/adr/`。

## Language — 导航与生命周期

**Welcome**:
应用启动后的项目选择页；无打开项目时在此创建或打开项目。
_Avoid_: 首页, landing, dashboard

**Project Hub**:
项目级视图；展示项目文件列表与项目元信息；`currentFileId === null` 时处于此态。
_Avoid_: 项目页, project page

**File Hub**:
与 Project Hub 同义（历史用语）；文档与代码中优先写 **Project Hub**。
_Avoid_: 文件列表页（泛指）

**Editor**:
打开某一音频文件后的转写编辑工作区（波形 + 语段列表 + 工具栏）。
_Avoid_: 编辑页, workspace（未特指时）

**Close Gate**:
离开 Editor / 关窗 / 换文件 / 换项目前的拦截链；未保存语段或转写 busy 时弹出专用对话框。
_Avoid_: 确认框, confirm dialog（未特指组件时）

**UnsavedCloseDialog** / **TranscribeNavBlockDialog**:
Close Gate 的两类专用对话框；禁止用 `window.confirm` 替代。
_Avoid_: 通用 modal, alert

## Language — 数据与持久化

**Project**:
SQLite `projects` 表中的一条记录；含多个 **File** 与可选 **Project metadata**。
_Avoid_: 工程, workspace root

**File**:
项目内一条音频转写记录；内存持 `segments[]`，持久化经 `file_save_segments`。
_Avoid_: 文档, media item

**Segment**（语段）:
带起止时间与说话人标签的转写文本单元；Editor 中编辑与波形绑定的基本粒度。
_Avoid_: 句子, clip, block（未定义时）

**Dirty state**（脏状态）:
语段相对上次保存有未落库修改；由 `useSegmentDirtyState` 驱动 Close Gate 与自动保存提示。
_Avoid_: 未保存 flag, modified bit

**Project metadata**:
项目级场次元信息（讲述人、录制时间、地点、主题、转录人）；存 `projects` 表 P0 五列；DOCX 导出可读。
_Avoid_: 元数据表单（泛指）

**Diagnostic bundle**（诊断包）:
导出问题复现用的打包产物；含 `edit_log` 摘要等；非逐键审计。
_Avoid_: debug zip（未特指格式时）

## Language — ASR 与能力状态

**ASR sidecar**（侧车）:
本机 Python ASR 服务（默认端口 8741）；桌面端经 HTTP 调用；与 Tauri 主进程分离。
_Avoid_: 后端, microservice（泛指）

**Provider**:
STT/LLM 的可插拔实现（本机 FunASR、在线 API 等）；配置与能力字段按 Provider 维度区分。
_Avoid_: 引擎, model（未特指 hub SKU 时）

**Hub model** / **SKU**:
本机 FunASR 模型目录中的可选模型标识（如 Paraformer、SenseVoice）；用户所选与侧车运行中可能不一致。
_Avoid_: 模型名（未带 hub 语境时）

**Capability—UI alignment**（能力—UI 对齐）:
同一面板内控件必须引用同一状态维度；见 `docs/architecture/desktop-capability-ui-state-alignment.md`。
_Avoid_: 健康检查对齐, ready 字段对齐

**D1 用户所选** / **D2 侧车运行** / **D4 按 SKU 缓存** / **D5 侧车全局就绪**:
能力状态的命名维度；禁止用 D5/D6 表示「当前所选 SKU 已下载或可转写」。
_Avoid_: ready_for_transcribe（单独指用户所选时）, 全局 cached

**Force restart**（侧车）:
切换模型或写 pref 后杀旧 8741 进程并启新进程；模型切换的必经路径。
_Avoid_: 刷新页面, reload health

**Online STT provider**（在线 STT 厂商）:
环境页「在线 STT」定义表中的一行（如 `dashscope-asr`、`iflytek-speed-asr`）；经 Rust native adapter 或 `custom-proxy` 出站；与本机 **ASR sidecar** 并列，勿称「模型」。
_Avoid_: 在线模型, cloud ASR（未特指 provider id 时）

**iflytek-speed-asr**:
讯飞开放平台 **极速录音转写大模型**（录音文件转写极速版 / speedTranscription）的 Rushi provider id；凭证三件套 AppID + APIKey + APISecret；engine 标记 `iflytek:speed-transcription:file`。
_Avoid_: iflytek-speech（已移除短听写）, LFASR v2（标准慢版 `raasr.xfyun.cn`, 非本 provider）, iflytek-lfasr（历史草稿 id）

**Vendor credential triplet**（厂商凭证三件套）:
在线 STT 中 AppID（可持久化 `appKey`）+ APIKey + APISecret（会话内存）；仅 `iflytek-speed-asr` 需要第三字段；百炼等仍用单 **apiKey** Bearer。
_Avoid_: 三个 API Key, 账号密码

**Credentials-only probe**（凭证探测）:
POST-only 厂商无法在环境页做 GET 健康检查；三字段齐全即报 `available`，首次转写才验配额与签名。
_Avoid_: 连接成功, ping 通过（未说明未发 HTTP 时）

**Xunfei accent preset**（讯飞口音预设）:
`iflytek-speed-asr` 环境页短列表（v1 共 8 项：普通话默认 + 粤语/四川/河南/东北/上海/闽南/维语）；映射 API `accent` 字段；不全量 202 方言。
_Avoid_: 方言下拉（泛指全量）, language 自由文本（v1）

## Language — 波形与编辑

**Waveform tier**:
波形区水平滚动容器；`tierScrollRef.scrollLeft` 为 UI 滚动真源；WaveSurfer 镜像而非反向真源。
_Avoid_: canvas scroll, WS scroll（作真源时）

**Segment band** / **Segment overlay**:
Canvas 语段色带（display）与 DOM 交互层（选中、拖拽）；非 WaveSurfer Regions。
_Avoid_: region, marker（WS 语境）

**Vertical slice**（纵向薄片）:
一次交付一个可验收端到端路径；spec 与 TDD 均按此粒度拆分。
_Avoid_: 横向批次, big bang

**Main shell surface**（主壳层）:
Welcome / Project Hub / Editor 的导航与 chrome（侧栏、顶栏、波形 tier 外壳、minimap 条等）统一 `notion-*` 中性底与 `notion-divider` 边线。
_Avoid_: 壳层使用 zen-paper, surface-card, ochre

**Content decoration surface**（内容装饰面）:
暖色 legacy token（`zen-paper`、`surface-card` 等）仅用于内容区装饰（Welcome hero、语段卡等），不进入导航壳层。
_Avoid_: 侧栏/工具栏暖纸底

**Shell accent**（壳层 accent）:
**Accent-action** / **Accent-action-strong**（`--accent-action` → 底层 `zen-saffron*`）= 语段选中 / 多选、CTA、进度、播放头、visited 带；**随 Office 主题色 remap**（含 **靛蓝 indigo** 预设）。`--accent-edit` 仅为兼容别名（等于 `--accent-action`）；无独立 `zen-indigo` 编辑色链。
_Avoid_: 组件直引 `--zen-saffron*` / `--zen-indigo`, 固定 hex 语段选中

**Accent-action** / **Accent-action-strong**:
语段选中 / 多选、动作、进度、CTA、播放头、minimap 视口、语段 visited 带的对外 token 链；随 Office accent 主题 remap。
_Avoid_: `--zen-saffron`, `--zen-saffron-mid`（组件层）, progress color（未分 action/strong 时）

**Progress chrome**（进度 chrome）:
播放头、已播放 peaks tint、语段 band visited、minimap playhead + viewport 框；统一 **accent-action** 族（strong 用于混中性底的 tint）。
_Avoid_: waveform-cursor, 播放头用 accent-edit

**Segment in-selection fill**（语段多选底色）:
Primary 选中外的多选态；列表 **8%**、波形 overlay **12%**，均 `--accent-action` mix。列表 / 波形 **主选** 用 `--segment-fill-selected` **28%** + 左缘 action 条。
_Avoid_: 列表与波形强行同百分比, 单独 indigo/edit 链

**Flat shell elevation**（扁平壳层层次）:
壳层与挂 `body` 的浮层（对话框、菜单、Toast）均靠背景差 + `1px notion-border` 分层，不用 drop shadow。
_Avoid_: shadow-2xl, 侧栏 edge shadow, 壳层阴影分层

## Language — 浮动对话框（壳层贴合）

**Floating dialog**（浮动对话框）:
可拖动、可缩放的 Notion/Zen 壳层对话框（`DraggableResizablePanel`）；挂 `document.body`，非 Editor 内嵌面板。
_Avoid_: modal（未特指 Radix 时）, 弹窗（泛指）, 面板（与侧栏/Inspector 混淆时）

**Auto-fit dialog**（自动贴合对话框）:
壳层高度真源为 **CSS 自动高度**（`height:auto` + 视口 `max-height` 封顶；无 JS 估算/实测）；语段列表少行时整框贴合内容，超出封顶后仅单一正文滚动区内滚；首帧即正确、无闪跳。例：查找替换、规则纠错 preview、智能改稿 preview。
_Avoid_: preview-list（代码枚举名，文档优先用本词）, 自适应弹窗（未定义行为时）, contentFitHeight / estimatedFitHeight（已退役）

**Fill dialog**（填充式对话框）:
壳层默认偏高、可手动拖大；正文或列表区在区内滚动，不随少行数把整框拉高。例：交付导出 Word、批量转写队列、术语表学习提示、Lexicon 导入导出。
_Avoid_: long-form dialog, hybrid-list, 长表单（未特指壳层行为时）

**Static-fit dialog**（静态贴合对话框）:
短文案或简单表单，无列表或列表极短；壳层贴合内容，无 fill 列表区。例：CompactConfirm、创建项目、ClearAsrCache。
_Avoid_: compact dialog（未特指 preset 时）, 确认框（Close Gate 专用对话框时用 UnsavedCloseDialog 等）

**Restore auto height**（恢复自动高度）:
浮动对话框标题栏双击；清 `userSized` 回到 CSS 自动高度（`heightMode: "auto"`）并重新居中。
_Avoid_: reset size, 恢复默认大小（未特指 auto-fit 时）

## Language — 工程与 spec

**Controller**:
页面级状态协调 hook（`useXxxController.ts`）；承载 Close Gate、导入、mutation 路由等；非纯 UI。
_Avoid_: 大 hook, page logic（未落位时）

**Orchestrator**:
页面组装层（如 `TranscriptionPage.Orchestrator.tsx`）；只透传与绑定事件，不累积重业务逻辑。
_Avoid_: 主页面（未强调职责边界时）

**Research brief**:
新功能/路线图薄片编码前的调研门禁文档（`*-research.md`）；须先于 Plan 定稿。
_Avoid_: spike 文档（当作终态时）

**Spec 三件套**:
`*-intent.md` + `*-plan.md` + `*-acceptance.md`；acceptance 链 research brief。
_Avoid_: PRD alone, ticket（本仓工作追踪用语）

**Architecture guard**:
`scripts/check-architecture-guard.mjs`；提交前硬阈值（行数、hook 数等）。
_Avoid_: lint（泛指）

**ADR**:
架构决策记录（`docs/adr/`）；记录难逆转、有 trade-off 的决策；非词汇表、非实现 spec。
_Avoid_: design doc（泛指）

## Relationships

- 一个 **Project** 包含多个 **File**；每个 **File** 包含多个 **Segment**
- **Editor** 编辑一个 **File**；经 **Close Gate** 回到 **Project Hub**
- **ASR sidecar** 为 Editor 转写提供能力；UI 须遵守 **Capability—UI alignment** 维度
- **Research brief** → **Spec 三件套** → Implement；术语变更同步回本 **CONTEXT.md**

## Flagged ambiguities

- 「文件 Hub」与「项目 Hub」— 统一称 **Project Hub**；`closeFile` 指 Editor → Hub，不是关项目。
- 「ready / cached / 可转写」— 必须标明 D1–D6 中哪一维；禁止混用全局 health 与用户所选 SKU。
- 「ticket / issue」— 本仓工作真源在 `docs/execution/specs/`，不是 GitHub Issues。
- 「选中 / highlight」— 语段与进度统一 **accent-action** 链；`accent-edit` 仅为兼容别名；禁止直引 `zen-saffron*`。
- 「主题色 / Office accent」— remap **accent-action** 链；success/cinnabar/status-warn、LLM chip 固定语义色不在此轮收束范围。
- 「编辑页 / 视角 / 层次感」— 全应用壳层精调时 scope = Welcome → Hub → Editor → 环境浮层；**Editor** 仅指已打开文件的转写工作区。
- 「LFASR / 讯飞转写」— 须区分 **iflytek-speed-asr**（极速 OST）、标准 LFASR v2、已移除 **iflytek-speech**；文档标题含 LFASR 时以 research §3 定稿 id 为准。
- 「面板 / 对话框」— 浮动工具框（查找替换等）称 **Floating dialog** 并按 **Auto-fit / Fill / Static-fit** 分类；Editor 侧栏/Inspector 不叫 Floating dialog。

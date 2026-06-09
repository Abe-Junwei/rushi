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

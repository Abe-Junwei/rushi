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
项目内一条可编辑语段容器（可有或无 `audio_path`）；类型见 `file_type`（`text` / `paired` / `audio_only`）；内存持 `segments[]`，持久化经 `file_save_segments`。
_Avoid_: 文档, media item；把 File 等同于「必有音频」

**file_type**（文件类型）:
持久化标签：`text` 纯语段无音频；`audio_only` 仅有音频待转写；`paired` 音频 + 语段。导入字幕挂到含 `audio_path` 的 File 后应为 `paired`。
_Avoid_: 待转写（作 UI 开关时）, 音视频（未对应 schema 值时）

**Transcript import**（转录稿导入）:
从外部 `.srt` / `.txt` 解析语段并写入目标 **File** 的操作；含 **Attach import** 与 Hub **Sidecar stem match** 两入口。
_Avoid_: 导入字幕（未说明挂到哪条 File 时）, import_text_to_project（实现名）

**Attach import**（挂接导入）:
在 **Editor** 中将转录稿导入到 **当前打开的 File**；整份 **Replace import** 语段，不新建 File。
_Avoid_: 导入转录文本（未说明挂接目标时）, 新建 text File（Editor 默认路径）

**Replace import**（替换导入）:
Attach / Sidecar 成功匹配后，清空目标 File 旧语段并以新文件内容为准；同目标 re-import 不走重复导入对话框。
_Avoid_: 合并导入, 创建新副本

**Sidecar stem match**（同名 sidecar 配对）:
在 **Project Hub**（无 `currentFileId`）导入时，用源路径 stem 匹配项目内 `paired` / `audio_only`；唯一匹配则 Attach；0 匹配新建 `text`；2+ 匹配弹窗选目标 File。
_Avoid_: fallbackWaveFile（UI 兜底，非配对真源）, 无脑打开最新 File

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

**Bundled default weights**（随包默认权重）:
安装包内嵌的默认 Paraformer 三件套（ASR+VAD+PUNC）权重，非 ModelScope 在线拉取；v0.1.8 起 macOS/Windows 安装介质均含此布局。
_Avoid_: 离线模型包, Route E zip, 打进侧车

**First-launch seed**（首启 seed）:
首次启动时将随包 `modelscope/` 树复制到 App Data 模型缓存；完成前不可本机转写；文案「正在准备内置语音模型…」。
_Avoid_: 导入离线包, prepare 下载（默认 SKU v0.1.8+）

**Capability—UI alignment**（能力—UI 对齐）:
同一面板内控件必须引用同一状态维度；见 `docs/architecture/desktop-capability-ui-state-alignment.md`。
_Avoid_: 健康检查对齐, ready 字段对齐

**D1 用户所选** / **D2 侧车运行** / **D4 按 SKU 缓存** / **D5 侧车全局就绪**:
能力状态的命名维度；禁止用 D5/D6 表示「当前所选 SKU 已下载或可转写」。
_Avoid_: ready_for_transcribe（单独指用户所选时）, 全局 cached

**D8 侧车权重内存**（model memory）:
当前 **D2** 所用 hub SKU 的 FunASR 权重是否已加载进 **ASR sidecar 进程 RAM**（`/health.funasr_loaded_model_id` / `selected_model_ready`）；与 **D4 落盘** 正交——D4 真仅表示磁盘缓存，不表示 ~3GB RAM 占用。
_Avoid_: 就绪（未说明 disk 或 RAM）, cached 表示内存已加载, warmup 与转写就绪混称

**Model unload**（侧车权重卸载）:
调用侧车 unload 路由，释放 FunASR 权重 RAM、保留 sidecar 进程与 **D4 磁盘缓存**；非 **Force restart**，非清除 App Data 模型目录。
_Avoid_: 杀侧车（未说明时）, 清除模型缓存, idle stop（进程级）

**Unload on idle file switch**（空闲换 File 卸载）:
**Editor** 内 `currentFileId` 变化或回到 **Project Hub** 时，若 transcribe/prepare **非 busy**，触发 **Model unload**；transcribe/prepare busy 时沿用 **Close Gate**，不换 File、不 unload。
_Avoid_: 离开应用, 每次转写结束立即 unload（v0.1.8.1 第一刀未选）

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

**Selection reveal**（选中 reveal）:
选中语段变更后，将 waveform tier 滚到使该语段在视口居中（或可见）；与 seek（移动播放头）分离。
_Avoid_: 选中即 seek, fit viewport（未说明仅 tier 滚动时）

**Editor focus gate**（编辑聚焦门闩）:
Selection reveal 仅在 **语段 textarea** 或 **waveform shell** 任一持有焦点时发生；焦点在 Hub、工具栏、侧栏等主壳层时，选中变更不触发 reveal。
_Avoid_: 全局选中即滚波形, listKeyboard（作 reveal 门闩名）

**Focus–selection lock**（focus=selected）:
语段 textarea 焦点与 `selectedIdx` 保持一致；结构快捷键（合并/拆分/Tab 进句/标注等）锚定 **selectedIdx**；非选中行 textarea 不得保持 focus（失选 blur）；若 focus 落入非选中行则先 `selectSegmentAt` 对齐。
_Avoid_: focus 段与 selected 段双轨, mergeAnchor 读 focus 优先于 selected

**Waveform scrub seek**（波形 scrub _seek）:
允许移动播放头的波形侧手势：**语段色带点击**（含段内再点）、**minimap 点击**、**主波形空白单击**；**不含**列表/键盘/Tab 导航，**不含**时间尺单击（时间尺单击只滚 tier）。
_Avoid_: 选中即 seek, 时间尺 seek（v0.1.8+ 产品矩阵）

**Segment band** / **Segment overlay**:
Canvas 语段色带（display）与 DOM 交互层（选中、拖拽）；非 WaveSurfer Regions。
_Avoid_: region, marker（WS 语境）

**SC1**（逻辑选中）:
Editor 内 **selectedIdx** + 多选集合等业务真源；驱动 footer/toolbar、filter banner、Close Gate 锚点、**Focus–selection lock**；经 `startTransition` 写入 React 可慢于视觉。
_Avoid_: highlight, 选中态（未区分 SC1/SC2 时）, chrome 真源

**SC2**（选中 chrome / 视觉层）:
列表行与波形条带的 **即时** 高亮（`.seg-row-selected`、overlay/band 色）；真源 **`selectionChromeStore`** + 波形 imperative；**不得**驱动 persist/undo 或替代 SC1。
_Avoid_: selectedIdx（指视觉时）, decoration（未特指 SC2 时）

**SC3**（多选集合）:
非 primary 的 **in-selection** 集合（Shift range、lasso）；与 SC1 primary、SC2 样式联动；`.seg-row-in-selection`。
_Avoid_: 多选 highlight（未特指 SC3 时）

**SC4**（列表 scroll 投影）:
语段列表 **虚拟窗** 与 tier scroll 解耦维度；选中变更 **不得** 无故 bump 虚拟窗 epoch / pin 全列表。
_Avoid_: 虚拟滚动（泛指实现时）

**Selection chrome publish**（选中 chrome 发布）:
点选 / 结构突变时 **显式** 写 `selectionChromeStore` + 波形 imperative；v0.1.9 **R-DROP**：无 reconcile 安全网，结构路径（merge/delete/undo/filter）须各自 publish。
_Avoid_: reconcile, 双写后对齐, flushSync 换 perf

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

## Language — 发行与更新

**Unsigned mac release**（unsigned mac 发行包）:
macOS 安装包未经 Apple codesign/公证；首次安装可能遇 Gatekeeper 提示；与 **In-app update** 独立。
_Avoid_: unassigned build, 未签名（未区分 OS 签名与 updater 签名时）

**In-app update**（应用内更新 / OTA）:
`tauri-plugin-updater` + Ed25519 更新 manifest（如 Release 上 `latest.json`）；验签用 `TAURI_SIGNING_PRIVATE_KEY` 公钥，**不**依赖 Apple 证书。
_Avoid_: 自动更新（未说明 Tauri updater 时）, App Store 更新

**OTA baseline version**（OTA 链起点版本）:
首个内置 updater 的 marketing 版本（当前规划 **v0.1.2**）；更早版本须 **手动重装一次** 该包后才能进入应用内更新链。
_Avoid_: 首个 Release, 升级起点（未特指 OTA 时）

**Release parity L3**:
在 **unsigned** 或 signed 安装包上的 UI 手测清单（CLN-066）；验证主路径 parity，**不**等同于 OTA 或 Apple 公证签收。
_Avoid_: 发版完成, E2E 全绿（未区分 L2/L3 时）

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
- 「导入转录文本 / 导入字幕」— Editor 默认 **Attach import**（挂当前 File）；Hub 默认 **Sidecar stem match**；均 **Replace import**，非新建副本。
- 「LFASR / 讯飞转写」— 须区分 **iflytek-speed-asr**（极速 OST）、标准 LFASR v2、已移除 **iflytek-speech**；文档标题含 LFASR 时以 research §3 定稿 id 为准。
- 「面板 / 对话框」— 浮动工具框（查找替换等）称 **Floating dialog** 并按 **Auto-fit / Fill / Static-fit** 分类；Editor 侧栏/Inspector 不叫 Floating dialog。
- 「选中 / highlight」— 须区分 **SC1**（逻辑 `selectedIdx`）与 **SC2**（视觉 chrome）；多选 in-selection 为 **SC3**；禁止用 SC2 表示 toolbar/footer 业务真源。
- 「自动更新 / 签名」— **In-app update** = Tauri Ed25519 manifest；**Unsigned mac release** = 无 Apple codesign/公证；二者可并存，勿混为一谈。

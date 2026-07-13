# 调研：每文件视图位置记忆与恢复（per-file view-state restore）

> **状态**：已采纳（编码中）
> **关联路线图**：编辑器体验 / 会话恢复（rev-loc 系列后续）
> **关联 spec**：本文即决策真源；acceptance 手测见成功标准
> **门禁**：调研 ✅；用户已确认首轮范围（含 layoutPxPerSec）后进入编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 听打/校对中途离开某文件（切文件、关项目、退出应用），再次打开时希望**从上次工作位置继续**，而非回到 0s / 第 1 段。 |
| 本仓现状 | 仅记住「上次打开的 `{projectId, fileId}`」：[`lastWorkspace.ts`](../../../apps/desktop/src/services/lastWorkspace.ts)（`rushi:last-workspace:v1`）。打开文件后播放头、波形 `scrollLeft`、选中语段**一律重置**：`openFile()` 固定 `selectedIdx=0`；[`useTierScrollMediaResetEffect.ts`] 把 `scrollLeft` 归 0；[`useWaveformMediaZoomResetEffect.ts`] 换媒体重置为 fit-all；SQLite `files` 无视图列。全局 prefs（字体、跟随、px/s 上限）走 [`waveformPrefs.ts`]，与文件无关。 |
| 成功标准 | 手测：文件 A 停在某语段附近（自定义缩放）→ 切 B 再回 A（同会话）+ 退出应用重开 → **选中该语段**、文本滚入视口、波形将该语段纳入视口、playhead 落在**语段开头**、**该文件 pxPerSec** 还原。精确 prior playhead / scrollLeft 非必须。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接 |
|---|------|-----------------|----------|------|
| A | **View-state per resource，关闭即存、重开即还原** | VS Code `workbench.editor.restoreViewState`（默认 true） | 每个文件保存光标+滚动+折叠等 view state；切 tab / reload / 重开都还原；可按语言关掉（如 commit message 从顶部开始） | [SO](https://stackoverflow.com/questions/50975271) · [vscode#101110](https://github.com/microsoft/vscode/issues/101110) |
| B | **Playback resume bookmark（位置=时间戳 + 预卷）** | Netflix/Roku「Continue Watching」、通用视频流 LLD | 存 `(user, content) → position_ms`；周期(10–30s)+暂停/退出/切后台时 upsert，last-write-wins；重开 seek 到该点；**回退 3–5s 预卷**帮助重新定位；接近结尾则视为看完、从头开始 | [Roku](https://developer.roku.com/dev/docs/continue-watching) · [LLD](https://www.techinterview.org/post/3233472706/lld-video-streaming-service/) · [DEV](https://dev.to/jyotheendra_doddala/designing-a-playback-resume-system-at-scale-its-not-just-a-timestamp-2il4) |
| C | **听打工具：不存跨会话位置，但暂停自动回卷** | oTranscribe | 刻意不记跨会话时间戳（重载从头）；但**暂停后恢复自动回退 1–2s** 找回语境；每几秒本地自动保存文本 | [oTranscribe help](https://otranscribe.com/) |

**共识提炼**：
1. 位置**按资源（文件）**存，不是全局单值 —— 与本仓 `lastWorkspace`（全局单值）互补。
2. 位置**不是一个标量**：编辑器类（A）存「光标+滚动」，播放类（B）存「时间戳」。听打编辑器同时是两者 → 需要 **(播放头, 选中语段, 波形滚动)** 元组。
3. **写时机**：离开/暂停/周期节流；**last-write-wins** 足够，不必强一致。
4. **预卷**（3–5s 视频 / 1–2s 听打）是跨产品一致的 UX 细节（本仓 oTranscribe-style 场景取小值）。
5. **边界护栏**：接近结尾从头开始；异常回退设阈值；可提供开关（VS Code 可关，Roku「从头播放」入口）。
6. 单机产品用**本地存储**即可（VS Code 本地、oTranscribe localStorage）；只有跨设备才需服务端（Netflix/Roku）——**Rushi 单机桌面，无需服务端**。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A（view-state per resource） | **高** | 「关闭存 / 打开还原 / 可开关」模型直接照搬到 `openFile`/`closeFile` | 无。契合单机、契合既有 lifecycle | 极小；localStorage 每文件一条 JSON |
| B（playback bookmark + 预卷） | **中高** | 时间戳存储 + seek + 预卷回退；节流写盘思路 | 服务端/跨设备**不需要**；周期心跳可弱化为「离开时存」+ 轻节流 | 无网络；无内存压力 |
| C（oTranscribe 回卷） | 低（作对照） | 「预卷 1–2s」取值参考 | 「不跨会话」正是要改的点 | — |

**本仓已有可复用模块**（必须先列再决定是否扩展）：

- [`lastWorkspace.ts`](../../../apps/desktop/src/services/lastWorkspace.ts) — localStorage 序列化/校验/容错模式（`try/catch` + 结构校验）**直接复刻**为 `fileViewState.ts`。
- 选中语段真源：CM6 `transcriptProjection` / `selectedIdxRef`（[`useProjectEditorState.ts`]）。
- 播放头：`wfApi.currentTime` / 显示层 playhead（`nativeAudioPlaybackTransport.ts` 的 `lastDisplaySec`）。
- 波形滚动：`useTierScrollSync.ts` 的 `scrollLeftRef`；重置真源 `useTierScrollMediaResetEffect.ts` / `useWaveformMediaZoomResetEffect.ts`（**须加"有存档则不重置"分支**，避免刚还原就被冲掉）。
- 生命周期落点：`useProjectCloseGateController.ts`（`commitOpenedFile` / `performCloseFile`）、`useProjectEditorState.ts`（`openFile`/`closeFile`）。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **A + B 融合、纯本地**：新增按 `fileId` 的 view-state 存储（复刻 `lastWorkspace` 模式），存 **`{ playheadSec, selectedSegmentUid, tierScrollLeftPx, layoutPxPerSec, updatedAtMs }`**。**离开文件时保存**（`performCloseFile`/`closeFile`，切文件/关项目/退出前都经此），**打开文件时还原**（`openFile` 读回 → 选中语段 by uid、恢复 `layoutPxPerSec`、波形就绪后 **reveal 语段入视口 + seek(语段开头)**；无 uid 时回退 playhead−预卷）。两个 media-reset effect 加「有存档则跳过重置」分支（**含跳过 fit-all 覆写全局 px/s**）。 |
| 不做什么 | 不做服务端 / 跨设备同步（单机）；不做周期心跳（仅离开 + 轻节流即可，崩溃丢失可接受）；**首轮不存** transcript 列表 `scrollTop`（用「滚到选中语段可见」代替）——列为后续可选；不改 `lastWorkspace` 语义；不加用户可见开关（首轮默认开，若有异议再补 prefs）。 |
| 与 ADR / architecture 关系 | 对齐 [`desktop-project-file-lifecycle.md`]（Close Gate / open/close 单一路径）；波形滚动对齐 ADR-0005 tier `scrollLeft`；缩放与 [`waveformPrefs.ts`](../../../apps/desktop/src/utils/waveformPrefs.ts) 并存——**per-file 存档优先于**换媒体时的 `writeStoredWaveformPxPerSecForMedia` fit-all；能力—UI 对齐规则不涉及。存储层新增，不引入第二套真源。 |
| 风险与 spike 项 | (1) **保存时序**：必须在 `closeFile` 清空 segments/audio **之前**捕获 → 在 gate 层取值。(2) **selectedSegmentUid vs idx**：增删语段后 idx 会错位，**存 uid**、还原时按 uid 查回、缺失则 clamp。(3) **还原被重置 effect 冲掉**：media-reset / zoom-reset effect 需感知「本次为还原」；`layoutPxPerSec` 须在 fit-all 写入**之前**应用或短路。(4) **scrollLeft 与缩放耦合**：先还原 px/s 再设 scrollLeft（或按 duration×px/s 重算合法范围），避免缩放变更后 scroll 越界。(5) 波形/transport **就绪时序**：seek 须等 `isReady`。以上建议 ≤0.5 天 spike 验证 open→还原→不被 reset 覆盖。 |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| 存储 | `apps/desktop/src/services/fileViewState.ts`（新） | `readFileViewState(fileId)` / `writeFileViewState(fileId, state)`，key `rushi:file-view-state:v1:${fileId}`；字段含 `layoutPxPerSec`；复刻 lastWorkspace 容错 |
| 保存 | `useProjectCloseGateController.ts`（`performCloseFile`）或 `useProjectEditorState.ts`（`closeFile` 清空前） | 捕获 playhead / selectedUid / scrollLeft / **当前 layoutPxPerSec** → write |
| 还原 | `useProjectEditorState.ts`（`openFile`）+ 波形层 | 读回：选中语段 by uid + 文本滚入视口；**先应用 layoutPxPerSec**；再 `revealSegmentInViewport`；波形就绪后 seek(**语段开头**；无 uid 则 playhead−预卷) |
| 还原护栏 | `useTierScrollMediaResetEffect.ts` · `useWaveformMediaZoomResetEffect.ts` · [`writeStoredWaveformPxPerSecForMedia`](../../../apps/desktop/src/utils/waveformPrefs.ts) | 有存档则跳过归零与 fit-all；可选：还原时写回全局 prefs 键以免 UI 读到旧值 |
| 测试 | `fileViewState.test.ts`（序列化/校验/clamp/pxPerSec）；扩展 close-gate / zoom-reset 测试（存-取往返、uid 缺失 clamp、接近结尾从头、有存档不 fit-all） | focused |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] 用户确认首轮范围（含 layoutPxPerSec）并进入编码
- [ ] intent / plan / acceptance 独立三件套（可选；本文成功标准可代验收）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-13 | 初版：业内 A/B/C 路线 + 评估 + 决策（A+B 融合、纯本地、存 uid、离开即存） |
| 2026-07-13 | 用户确认：首轮纳入 **per-file `layoutPxPerSec`**；强调先还原缩放再 scrollLeft |
| 2026-07-13 | 用户确认进入编码；实现落地 |

# 调研：编辑器工作条（波形—语段 chrome）布局与信息层级

> **状态**：薄片 1–6 已编码（2026-06-06）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)（桌面 UI 重设计期 · 纵向薄片）  
> **关联 spec**：待 `editor-workbench-toolbar-layout-intent.md` / `…-acceptance.md`（编码前须链接本文）  
> **前置**：波形渲染架构见 [`archive/waveform-pre-ws-only-2026-05/waveform-maturity-product-research.md`](./archive/waveform-pre-ws-only-2026-05/waveform-maturity-product-research.md)（**不重复** peaks/tile 议题）  
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 用户在改稿工作台长时间「听 + 看波形 + 改语段」：播放/定位、缩放时间轴、触发转录与批量编辑、阅读底栏状态。需要 **少分心、少误点、窄窗仍可用**。 |
| **本仓现状** | 垂直结构（[`EditorView.tsx`](../../../apps/desktop/src/components/EditorView.tsx)）：<br>① 顶栏 [`EditorToolbar`](../../../apps/desktop/src/components/EditorToolbar.tsx)（48px，项目/导入导出/保存）<br>② [`EditorWaveformPane`](../../../apps/desktop/src/components/editor/EditorWaveformPane.tsx)（可拖拽高度 + 可选 minimap）<br>③ 统一工作条 [`EditorWorkbenchToolbar`](../../../apps/desktop/src/components/editor/EditorWorkbenchToolbar.tsx)（48px，左播放 / 中转录编辑 / 右缩放）<br>④ [`EditorSegmentWorkbench`](../../../apps/desktop/src/components/editor/EditorSegmentWorkbench.tsx)（语段列表主舞台）<br>⑤ 底栏 30px（撤销/历史/自动保存 · 居中 hint · 语段/字数统计）<br><br>**播放双入口**：工作条全局 transport + 波形浮层 [`WaveformSegmentPlaybackControls`](../../../apps/desktop/src/components/WaveformSegmentPlaybackControls.tsx)（语段 play/loop/**独立倍速**）。倍速分 [`useWaveformGlobalPlayback`](../../../apps/desktop/src/hooks/useWaveformGlobalPlayback.ts) 与 [`useWaveformSegmentPlaybackControls`](../../../apps/desktop/src/hooks/useWaveformSegmentPlaybackControls.ts) 两路 localStorage。<br><br>**视觉**：已去掉 `toolbar-sep` 竖线；`跟随\|居中` 仍为 segment control 内分隔；中间四项 [`EditorSegmentTranscribeActions`](../../../apps/desktop/src/components/editor/EditorSegmentToolbarActions.tsx) 均为 ghost 等权重。<br><br>**文档漂移**：根 [`DESIGN.md`](../../../DESIGN.md) §Waveform stage 仍写「底栏 transport 40px」，实现为 **工作条 48px** 且位置在波形与语段 **之间**。 |
| **成功标准** | 手测主路径：（1）新用户 30s 内能区分「播整段 / 播本段 / 改稿操作 / 缩放视图」；（2）1280×800 下工作条无关键按钮被裁切且 popover 不被遮；（3）语段列表可视行数相对现状 **不减少**（chrome 垂直占用 ≤ 现网或略降）；（4）`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 通过。 |

### 1.1 已识别痛点（来自产品走查 + 近期 bug 修复）

| # | 痛点 | 根因线索 |
|---|------|----------|
| P1 | 垂直 chrome 偏多 | 顶栏 48 + 工作条 48 + 底栏 30 ≈ **126px** 固定高度（不含波形） |
| P2 | 两套播放/倍速认知负担 | 全局 bar + 语段 overlay；segment rate 与 global rate 可不一致 |
| P3 | 中间编辑动作无主次 | 四类 ghost 按钮视觉等价；空稿时「自动转录」未 Primary 化 |
| P4 | 左右控件形态混用 | 圆形播放 36px、方 icon 34px、segment 跟随 34px、中间 h-9 带字 |
| P5 | 窄窗兜底靠横向滚动 | `.editor-workbench-toolbar-track { overflow-x: auto }`，无断点折叠 |
| P6 | 底栏 hint 绝对居中 | [`EditorView`](../../../apps/desktop/src/components/EditorView.tsx) footer 三列与居中 `aria-live` 窄窗易叠字 |
| P7 | 分组语义弱 | 去掉竖线后左/右/中三组仅靠 gap，与 Notion/Figma「浅底 pill 分组」惯例有差距 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表产品 | 核心机制 | 可验证链接 / 路径 |
|---|------|----------|----------|-------------------|
| **A** | **文稿优先 · 可折叠时间轴** | Descript | 默认 **Script 为主**；时间轴/transport **折叠**，拖 handle 展开；transport 在 **时间轴顶缘**（播放、场景跳转、**单一** 倍速）；缩放与高级工具在 **时间轴右上**（Fit scene / Fit composition）；词级 wordbar 与脚本同步 | [Timeline overview](https://help.descript.com/hc/en-us/articles/10249275208717-Timeline-overview) · [Playback and navigation](https://help.descript.com/hc/en-us/articles/10164534109837-Playback-and-navigation) |
| **B** | **NLE 时间轴附属 chrome** | DaVinci Resolve / Premiere / Pinnacle Studio | **Timeline toolbar 紧贴时间轴上方**：编辑工具 + transport + **离散 zoom 预设**（Full extent / Detail / Custom slider）；底栏/Viewer 下 **状态与快捷键提示**；功能按 **左工具 / 右视图** 分区，可定制隐藏 | [Resolve Editors Guide — Timeline Zoom](https://documents.blackmagicdesign.com/UserManuals/DaVinci-Resolve-17-Editors-Guide.pdf) · [Pinnacle Timeline toolbar](https://help.pinnaclesys.com/pinnacle/v23/en/help/pinnacle-studio/h2-the-timeline-toolbar.html) |
| **C** | **独立播放器 + 文稿列** | Otter.ai | **左侧固定 audio player**（播放/倍速/跳转），中间 transcript，**编辑与播放 UI 分离**；播放快捷键在帮助文档集中说明（Esc/Ctrl+Space、F3/F4 变速） | [Conversation Page Overview](https://help.otter.ai/hc/en-us/articles/5093228433687-Conversation-Page-Overview) · [Keyboard Shortcuts](https://help.otter.ai/hc/en-us/articles/29431724341399-Keyboard-Shortcuts) |
| **D** | **中性编辑器分组（无竖线）** | Notion / Figma / Linear | 工具组用 **浅底 rounded container / segment control** 表达边界；Primary 动作 **单一 saffron/brand**；Secondary ghost；状态用 **badge** 而非重复控件 | 本仓 [`DESIGN.md`](../../../DESIGN.md) §Buttons / §Elevation |

### 2.1 路线对照（与 Rushi 场景）

| 维度 | Rushi 现状 | A Descript | B NLE | C Otter |
|------|------------|------------|-------|---------|
| 主舞台 | 语段列表 + 波形并列上下 | Script 为主，timeline 辅助 | 时间轴为主 | Transcript 为主 |
| Transport 位置 | 波形下工作条 + 语段浮层 | 时间轴顶 transport | 时间轴 toolbar | 侧栏 player |
| 倍速入口 | 2（global + segment） | **1**（项目级 playback speed） | 通常 1（viewer/transport） | **1**（player） |
| 缩放 | 右区 icon + 已有 fit selection/all | Fit scene / composition | Full extent / Detail / slider | 无独立时间轴缩放 |
| 批量编辑 | 工作条居中常驻 | 脚本内 + AI 面板 | 非时间轴 toolbar 主职责 | 顶栏/导出 |
| 底栏 | 30px 混合状态 | 较少占用（web app） | 状态栏 + 快捷键提示 | 播放器内嵌 |

**结论**：Rushi 更接近 **A（文稿优先）+ B（时间轴 chrome）混合**——已有「波形上 / 工作条贴 timeline / 语段下」骨架，**不应**整体改成 Otter 三栏（C 仅借鉴「单一播放面」）。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| **A Descript** | **中** | 文稿优先层级；transport **贴 timeline**；**单一** 倍速；空稿 Primary CTA；时间轴默认可折叠（未来） | 无 Descript 式 Storyboard/多轨；本地离线 ASR 流程更重 | 仅 UI/CSS，无运行时成本 |
| **B NLE** | **高** | 工作条已在波形—语段缝；右区 zoom 预设已对齐 Fit selection/all/±/reset；底栏作 status | 不宜引入完整 editing mode 切换（刀片/滑移等） | 仅 UI；须遵守 [ADR-0005 单 scroll 真源](../adr/0005-waveform-single-scroll-authority.md) |
| **C Otter** | **低** | **单一播放器**心智；快捷键文档化 | 侧栏 player 与现有 tier scroll / 波形 overlay **布局冲突** | — |
| **D Notion Zen** | **高** | pill 分组、Primary/ghost、badge 状态；与 [`controlStyles.ts`](../../../apps/desktop/src/config/controlStyles.ts) 一致 | 面板 **≤2 层 border**（Jieyu）；新 pill 用 background 不用第三层 border | — |

**本仓已有可复用模块**（须扩展，禁止平行真源）：

| 模块 | 路径 | 说明 |
|------|------|------|
| 统一工作条 | `EditorWorkbenchToolbar.tsx` | 三栏 grid 真源 |
| 居中编辑动作 | `EditorSegmentToolbarActions.tsx` + `editorSegmentToolbarStyles.ts` | `workbenchLabelBtnClass(active)` |
| 缩放语义 | `WaveformZoomBar.tsx` + `waveformZoomBarState.ts` | 已有 fit selection/all active 态 |
| 全局/语段播放 | `useWaveformGlobalPlayback.ts` + `useWaveformSegmentPlaybackControls.ts` | 倍速双轨；`useGlobalPlaybackRate` 选项已存在 |
| 语段浮层布局 | `waveformRegionActionOverlay.ts` + `WaveformSegmentPlaybackControls.tsx` | `coordinateSpace: "timeline"` |
| 倍速 UI | `WaveformPlaybackRateMenu.tsx` | portal + tier scroll 锚点同步 |
| 滚屏模式 | `WaveformPlaybackScrollFollowMode.tsx` | segment control |
| 样式真源 | `waveform.css` + `tokens.ts` + `DESIGN.md` | 禁止散落 hex |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **分阶段「B 骨架 + A 层级 + D 视觉」**，不推翻现有 `EditorWorkbenchToolbar` 位置：<br>**薄片 1（推荐先做）**：信息层级 + 分组视觉 — 中间 Primary（空稿/可转录时「自动转录」）、转写中 danger「停止」独占；左/右 **浅底 pill 分组**（替代已移除的竖线）；统一 icon 触控高（34px 或 DESIGN 对齐 32px）。<br>**薄片 2**：播放职责 — 语段浮层 **保留 play/loop**；倍速 **收敛为全局单一真源**（overlay 只读指示或点击聚焦 global menu）；segment rate 存储 deprecate 或迁移合并。<br>**薄片 3**：底栏 — 三列 grid 化 hint，避免 absolute 居中叠字；可选 32px 高。<br>**薄片 4**：响应式 — `<1024px` 中间四项收进「编辑 ▾」；右区 zoom 保留 ±，其余进菜单。 |
| **不做什么** | ① 不做 Otter 式左栏 player 大改；② 不恢复「波形底栏 + 语段顶栏」双条；③ 不引入 Descript 多轨/Blade/Slip 工具栏；④ 不在本薄片改 peaks/scroll 引擎（见 waveform 调研）；⑤ 不合并 `EditorToolbar` 与工作条（文件层 vs 会话层职责分离）。 |
| **与 ADR / architecture 关系** | [ADR-0005](../adr/0005-waveform-single-scroll-authority.md)：pill/折叠 **不得** 新增第二 scroll 容器；popover 继续 portal。[`desktop-waveform-engine.md`](../architecture/desktop-waveform-engine.md)：overlay 仍消费 `resolveTierViewportMetrics`。[`DESIGN.md`](../../../DESIGN.md)：实施后 **同步** 工作条高度/分组/transport 描述。 |
| **风险与 spike 项** | **R1** 倍速合并可能影响「语段 Tab 听打」独立变速习惯 → acceptance 手测 + 保留 migration（读旧 segment key 写 global）。**R2** 断点折叠需定义 `min-width` 与 E2E 快照。**R3** Primary 化「自动转录」须与 `canOfferPostTranscribe` / busy 矩阵对齐（见 capability-ui-state 文档）。**Spike（≤0.5d，可选）**：Figma 式 pill 分组 2 方案静态 mock（仅 `waveform.css` 原型，不提交业务逻辑）。 |

### 4.1 推荐优先级（对应前期走查）

| 优先级 | 项 | 参照 | 工作量 |
|--------|-----|------|--------|
| P0 | 中间按钮主次 + 转写中独占 danger | A Descript CTA 层级 + D Primary | 0.5–1d |
| P0 | 左/右 pill 分组（无 border 第三层） | D Notion/Figma | 0.5d |
| P1 | 倍速单一真源 + 浮层简化 | A/C 单一 playback speed | 1d |
| P1 | 底栏 grid / hint 不叠字 | B status bar | 0.5d |
| P2 | 工作条高 48→40 或 icon 统一 32px | DESIGN 原 40px 意图 | 0.5d |
| P2 | 断点折叠菜单 | B 可定制 toolbar | 1–1.5d |
| P3 | 无音频时空工作条布局 | A 折叠 timeline | 0.5d |
| P3 | 快捷键 hint 轮换 | B / Otter 文档化 | 0.5d |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI 组件 | `EditorWorkbenchToolbar.tsx` | pill 包裹 left/right；无音频布局 |
| UI 组件 | `EditorSegmentToolbarActions.tsx` | Primary/danger 态；可选折叠入口 |
| UI 组件 | `WaveformSegmentPlaybackControls.tsx` | 倍速只读或移除 menu |
| UI 组件 | `WaveformZoomBar.tsx` | 窄窗折叠（薄片 4） |
| UI 组件 | `EditorView.tsx` | footer 三列 grid |
| 样式 | `waveform.css` | `.workbench-toolbar-group` pill；高度 token |
| 样式 | `editorSegmentToolbarStyles.ts` | primary variant |
| Hook | `useWaveformSegmentPlaybackControls.ts` | 倍速合并 / migration |
| Hook | `useWaveformGlobalPlayback.ts` | 吸收 segment rate（若合并） |
| 文档 | `DESIGN.md` §Waveform stage / Components | 工作条 48/40、分组、单一倍速 |
| 文档 | `docs/architecture/desktop-waveform-engine.md` | §playback chrome 一句（可选） |
| 测试 | `waveformRegionActionOverlay.test.ts` | 已有；overlay 变更回归 |
| 测试 | 新增 `editorWorkbenchToolbar*.test.ts` 或 story | 断点折叠逻辑（若做薄片 4） |
| Rust / Python | — | **本议题不涉及** |

---

## 6. 签收

- [x] 调研 brief 完成（2026-06-06）
- [ ] intent / plan / acceptance 已链接本文
- [ ] 用户或路线图确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-06 | 初版：工作条布局/层级/播放双入口/竞品对照与分阶段决策 |
| 2026-06-06 | 薄片 5：无音频文件 40px 居中编辑条（`editor-workbench-toolbar--no-audio`） |
| 2026-06-06 | 薄片 6：有音频工作条 48→40px + 32px 触控；底栏快捷键 hint 8s 轮换 |

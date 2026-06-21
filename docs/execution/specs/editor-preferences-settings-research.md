# 调研：编辑器偏好设置补齐

> **状态**：已落地（2026-06-21）  
> **关联 spec**：环境页「偏好设置」[`EnvPreferencesPanel.tsx`](../../../apps/desktop/src/components/EnvPreferencesPanel.tsx)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 听打/校对用户希望 **转写页行为可预期、可恢复**（Tab 是否 loop、播放滚屏、字号默认值等），而不是靠 DevTools 改 `localStorage`；换机/重装时希望 **编辑器偏好可迁移** |
| 本仓现状 | **环境页**（⌘,）偏重 **能力配置**（本机 ASR / 在线 STT / LLM / 外观 / 配置迁移）；**转写页行为偏好** 分散在工具条拖拽、右键菜单、zoom 条，且多项 **仅有 storage 无 UI** |
| 成功标准 | 手测清单中标注的偏好（如 H8/H9 Tab loop）可在设置中找到；`waveformPrefs` / `editorTranscript*` 关键项有统一入口；profile 导出覆盖用户期望的「工作流偏好」 |

---

## 2. 本仓偏好盘点（真源：代码 2026-06）

### 2.1 已有设置 UI（环境页 ⌘,）

| 导航 | 内容 | 持久化 |
|------|------|--------|
| 本机 ASR | 模型、识别语言、诊断/缓存 | localStorage + Tauri `prefs/*.txt` |
| 在线 STT | 厂商、Key、超时等 | localStorage + Keychain |
| LLM | Provider、模型、Prompt 三组 | localStorage + Keychain |
| 外观 | 界面主题、主题色 | localStorage |
| 快捷键 | **只读** 参考表 | 无（硬编码 registry） |
| 配置迁移 | 导出/导入 JSON | **仅 LLM + 在线 STT**（`SettingsProfileV1`） |
| 质量评测 / 关于 | 工具 / 版本 | — |

### 2.2 转写页内「隐式偏好」（有 UI，但不在设置页）

| 偏好 | Key / 来源 | 调节方式 | 默认 |
|------|------------|----------|------|
| 波形高度 | `rushi.p1.waveformHeightPx` | 波形底缘拖拽 | 220px |
| 横向缩放 | `rushi.p1.waveformPxPerSec` | Zoom 条 / 滚轮 | 按媒体 fit |
| 字号 | `rushi.p1.transcriptFontPx` | 行高拖拽 / 右键字号 | 13px |
| 字体族/粗体/斜体 | `rushi.editor.transcript.*` | 语段右键 |  catalog 首项 / 500 / off |
| 元信息列宽 | `rushi.editor.transcript.metaWidthPx` | 列边拖拽 | 104–260 |
| Minimap | `rushi.p1.waveformMinimap` | Zoom 条菜单 | 开 |
| 播放滚屏 | `rushi.p1.waveformPlaybackScrollFollow` | 工具条 | center |
| 全局倍速 | `rushi.p1.waveformGlobalPlaybackRate` | 工具条 | 1× |
| 侧栏折叠 | `rushi.editor-workspace-sidebar-collapsed` | 壳层 toggle | 展开 |

### 2.3 **缺口：有持久化、无设置 UI**（补齐候选 P0/P1）

| 优先级 | Key | 含义 | 影响 | 备注 |
|:--:|-----|------|------|------|
| **P0** | `rushi.p1.tabAdvanceLoopsSegment` | Tab 定稿跳下一段后 **loop 播放** | H8/H9 手测需 DevTools | `writeStored*` 存在但 **从未被 UI 调用**；默认 **开** |
| **P1** | （无 key）语段列表 **筛选** | 阶段/备注 filter | 换文件即重置 | `useSegmentListFilter` 仅 session state |
| **P1** | `rushi.p1.waveformHeightPx` 等波形/字号 **默认值** | 新装首启体验 | 只能拖出当前值 | 竞品多在 Settings 给默认，拖拽仍覆盖 |
| **P2** | `WAVEFORM_BACKGROUND_PEAKS_ENABLED` 等 | 后台 peaks / 播放中热切换 | 文档仍写 localStorage | **编译期常量**，非用户 pref；需文档修正或刻意不做 UI |
| **P2** | 段边界 snap | Shift 吸附 | spec 曾提「设置页开关」 | 当前仅 modifier，无持久开关 |
| **—** | 快捷键自定义 | 改绑定 | — | [`editor-keyboard-shortcuts-research.md`](./editor-keyboard-shortcuts-research.md) **明确不做** |

### 2.4 Profile 导出缺口

`SettingsProfileV1` **不含**：本机 ASR 模型/语言、波形/转写外观、Tab loop、minimap、播放滚屏、侧栏状态。用户「配置迁移」名不副实（仅云端能力栈）。

### 2.5 文档漂移

[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) §偏好仍列已移除的 `autoFitSelectionToViewport`、误标 `waveformBackgroundPeaks` 为 localStorage；§Route C2 仍写「工具栏波形菜单」— 当前已并入 workbench toolbar。

---

## 3. 业内成熟路线（≥3）

| # | 产品 | 设置入口 | 编辑器/听打相关偏好 | 快捷键 |
|---|------|----------|---------------------|--------|
| **A** | **Descript** | ⌘, → General / Account / Drive 分组 | 默认转写语言、转写前询问、说话人检测、术语表自动学习；播放/自动卷动（Esc 关 autoscroll）；**无** 用户改键 | 只读表；Option+/ 打开；**不支持 remapping** |
| **B** | **Trint** | 编辑器右下角 **Settings** | **Auto-pause when typing**（默认开）；播放速度在波形条；mobile 有独立 Editor settings | 文档型 shortcuts 页 |
| **C** | **Aegisub** | Alt+0 **Options** 全屏偏好树 | **Video autoscroll**、**Audio autoscroll**、选中行 seek 视频、波形居中；timing 时可关 autoscroll | **完整 Hotkeys 页**，双击改绑；分 Default/Video/Audio 焦点组 |
| **D** | **Otter** | Web Settings + 对话页内控件 | 播放速度菜单；自动跟随高亮（**无**关 autoscroll 开关）；OtterPilot 日历过滤 | 只读；F3/F4 变速 |

**链接**

- Descript App settings: https://help.descript.com/hc/en-us/articles/10606771145869-App-settings  
- Descript Keyboard shortcuts: https://help.descript.com/hc/en-us/articles/10255582172173-Keyboard-shortcuts  
- Trint playback settings: https://info.trint.com/knowledge/how-do-i-playback-my-transcript-trint-help-center  
- Aegisub Options / autoscroll: https://aegisub.org/docs/latest/options/ · https://aegisub.org/docs/latest/timing/

---

## 4. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / UX |
|------|--------|----------------|-------------------|-----------|
| **A Descript** | **高** | ⌘, 全局设置 + **General 工作流开关**（语言/loop 类布尔）；播放 shortcuts 文档化 | Drive 级设置 vs Rushi 项目级 SQLite — 编辑器 pref 应 **全局** | 开关少而清晰；不适合塞 20 个 slider |
| **B Trint** | **高** | **编辑器内 Settings 子集**（typing ↔ playback）；与主 Settings 分离 | Rushi 已有 Environment 大包 — 宜 **环境页「转写编辑」子页**，非右下角浮层 | Auto-pause 与 Rushi「列表不 seek」哲学需对齐 |
| **C Aegisub** | **中** | 分 **autoscroll / seek-on-select** 独立 toggle；timing 模式临时关 scroll | 专业字幕工具粒度太细；Rushi **已有** center/edge 滚屏 + reveal 策略矩阵 | 改键系统 **不做**（已定） |
| **D Otter** | **低** | 播放速度 UI 就近放置 | 会议笔记产品，少「tier/语段」概念 | — |

**本仓可复用模块（须扩展，禁止第二套真源）**

- 读写：`waveformPrefs.ts`、`useEditorTranscriptAppearance.ts`、`useWaveformEditorRoutePrefs.ts`
- UI 壳：`EnvironmentPanel` + `ENV_NAV_ITEM_DEFS`（[`environmentPanelNav.ts`](../../../apps/desktop/src/utils/environmentPanelNav.ts)）
- 导出：`profileContract.ts` → 扩展 `SettingsProfileV2` 或 `editor` 段
- 展示：`EnvEditorShortcutsPanel` 模式（只读 + 分组）

---

## 5. 决策摘要（建议）

| 问题 | 结论 |
|------|------|
| **选定 IA** | 环境页新增 **「转写编辑」**（`editor` nav id）：承接 **听打/波形/列表工作流偏好**；**外观** 仍只管 shell 主题；**不**把 LLM/STT 与 Tab loop 混在同一 section |
| **P0 首批** | ① Tab loop toggle（接 `writeStoredTabAdvanceLoopsSegment`）② 播放滚屏 mode ③ Minimap 默认 ④ 全局倍速默认（可选）⑤ 语段默认字号 — 均 **双向绑定** 现有 storage |
| **P1** | ⑥ 列表筛选 **持久化**（per-user，换文件保留或「记住上次」需 Plan 定）⑦ Profile 导出增加 `editor` + `local_asr` 段 ⑧ 修正 `desktop-waveform-engine.md` 偏好表 |
| **P2 / 不做** | 用户 **自定义快捷键**；Aegisub 级 autoscroll 多开关（与 F3/L1 矩阵重复）；后台 peaks 用户开关（除非有 support 诉求） |
| **Trint 借鉴** | **「输入时暂停播放」** — Rushi 未实现；若做需单独 research（与 Tab queue / play 交互） |
| **Descript 借鉴** | 布尔工作流开关 + General 分组；术语表已在 Rushi 为 **项目级** 能力，不进全局 pref |
| **风险** | 设置项过多 → 违反 R3d「轻量 IA」；应用 **两层**：常用 4–6 项在「转写编辑」，高级（peaks）进本机 ASR 维护或不做 |

---

## 6. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI | `environmentPanelNav.ts` — 新增 `editor` nav | 导航项 |
| UI | `EnvEditorPreferencesPanel.tsx`（新） | Tab loop、滚屏、minimap、默认字号/波形高度 reset |
| UI | `EnvironmentPanel.tsx` — 路由新页 | 组装 |
| Service | `waveformPrefs.ts` — 已有 write API 接线 | 无新 key |
| Service | `profileContract.ts` — `SettingsProfileV2.editor` | 导出/导入 |
| Service | `segmentListFilter.ts` + persistence key（待定） | P1 |
| Docs | `desktop-waveform-engine.md` §偏好 | 与代码对齐 |
| 测试 | panel persistence test、profile roundtrip | 定向 vitest |

**禁止**：第二套 parallel pref store；在 `EditorWorkbenchToolbar` 再叠一层「波形菜单」偏好（已合并进 toolbar，设置页做 **默认值/开关** 即可）。

---

## 7. 建议补齐清单（按 ROI 排序）

| # | 项 | 竞品参照 | Rushi 现状 | 建议落位 |
|---|-----|----------|------------|----------|
| 1 | Tab 跳下一段并 loop | Descript 式 General 开关 | storage 无 UI | **P0** · 转写编辑 |
| 2 | 播放滚屏 center/edge | Aegisub autoscroll 概念 | 仅工具条 | **P0** · 转写编辑（与工具条同步） |
| 3 | 波形总览 minimap | Descript 无直接对应 | 仅 zoom 条 | **P0** · 转写编辑 |
| 4 | 默认字号 / 波形高度 | 各产品「默认 + 拖拽覆盖」 | 仅拖拽 | **P1** · 转写编辑 + 「恢复默认」 |
| 5 | 语段字体/元信息列宽 | 右键 + 拖拽 | 无集中管理 | **P1** · 转写编辑只读摘要 + 「在编辑器中调整」hint |
| 6 | 列表筛选记忆 | 少见 | session only | **P1** · 待定 key |
| 7 | Profile 含 editor + ASR | Descript Drive settings | 仅 LLM/STT | **P1** · profile v2 |
| 8 | 输入时暂停播放 | **Trint** | 无 | **P2** · 单独立项 research |
| 9 | 快捷键改绑 | Aegisub | 已决策不做 | **不做** |
| 10 | 段 snap 默认开/关 | Aegisub 吸附 | modifier only | **P2** · 低优先 |

---

## 8. 签收

- [x] 调研 brief 完成
- [x] P0 偏好 UI 落地（环境页「偏好设置」）
- [ ] intent / plan / acceptance 链接本文（轻量 IA，未单独写三件套）
- [x] 用户确认 P0 范围后编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版：本仓盘点 + Descript/Trint/Aegisub/Otter 对照 + P0–P2 建议 |
| 2026-06-21 | 落地：环境页「偏好设置」合并外观 + P0 转写偏好 + profile v2 + 列表筛选持久化 |

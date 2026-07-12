# 调研：全局播 ↔ 语段播 交叉切换（业内对照）

> **状态**：已采纳（用户确认 · 2026-07-12：**会话粘性 Space** + 工具条明示「全局播放」）  
> **关联**：[`global-vs-segment-playback-ux-research.md`](./global-vs-segment-playback-ux-research.md) · [`transcript-segment-play-beside-text-research.md`](./transcript-segment-play-beside-text-research.md)  
> **关联 architecture**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) Transport Authority  
> **门禁**：交叉语义以本文 §4 为准

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 通读中想「只听这句」；校对段播暂停后想「重播该句」；跳到新句想「开段播」；需要明确出口回到通读。 |
| **本仓现状（改前）** | Space/主钮 = 一律 `beginGlobalPlayback`；段播中 Space = pause + 清会话 → 再 Space = **全局**（非重播该句）。 |
| **成功标准** | Space 粘性：段结束/暂停后 Space = 重播该句；听跳新句 = 开段播；工具条明示全局出口。不新造第二套播放栈。 |

关键实现：

- Space：`useProjectWaveform.togglePlay`（`playbackSession` sticky）
- 工具条：`toggleGlobalPlay`（始终全局 / 段播中撕 bound 出口）
- 语段：`playSegmentAtIndex` / 旁侧·浮层

---

## 2. 业内成熟路线（≥3）

### 2.1 产品对照表（交叉行为）

| 产品 | 主播放语义 | 「选区/句」播放 | 主播中点选区播 | 选区播中点主钮 / Space |
|------|------------|----------------|----------------|------------------------|
| **Otter** | 单一 transport；点词 = **听跳**（仍全局续播） | **几乎无**独立「只播这句到句尾」辅钮 | N/A | Space/Esc = **pause** |
| **Descript** | Space / 主钮 = playhead 起停 | 时间线 Range 等 | 点文/导航多半 **seek+续播** | Space = **pause at playhead**（再 Space 从停点续） |
| **Trint** | 波形条 **主 Play** = 整轨通读 | 旁侧 **小黄钮** = 只播 highlight | 黄钮 = **进入选区播** | 主钮与黄钮语义分离 |
| **Audacity** | 有选区时 Space = scoped | 选区即约束主 Play | （同一按钮） | Space = Stop；再 Space 从原起点 |
| **Premiere** | Space = 时间线 play/pause | **独立命令** Play In to Out | 选区播另键 | Space = pause |

可验证链接：Descript / Trint / Otter / Audacity / Premiere（见初版附录）。

### 2.2 归纳

| # | 路线 | 核心 | 代表 |
|---|------|------|------|
| **A** | 单 transport + 听跳 | 只有播/停；点句 = seek | Otter · Descript |
| **B** | 双入口并列 | 主=整轨；辅=句 scoped | Trint |
| **C** | 语境敏感 Space / 独立选区命令 | Audacity / Premiere | — |
| **B′** | **B + 会话粘性 Space** | Space 记住上次全局/语段会话；工具条专责全局出口 | Rushi（本薄片） |

---

## 3. 可复用评估

| 路线 | 复用度 | 与 Rushi 冲突 | UX |
|------|--------|---------------|-----|
| A | 中 | 削弱「播本句到尾」 | 最简 |
| B | 高 | 无 | 双入口清晰 |
| **B′ 粘性** | **高** | 无；复用 `playSegmentAtIndex` / `beginGlobalPlayback` / bound | Space 校对友好；工具条「全局」明示出口 |
| C | 低 | 已否决双义 Space（有选中即 scoped） | — |

**本仓必须复用：** `togglePlay` · `toggleGlobalPlay` · `beginGlobalPlayback` · `playSegmentAtIndex` · `segmentPlaybackBound` · Transport Authority。

---

## 4. 决策摘要（**已签收 · 会话粘性**）

| 问题 | 结论 |
|------|------|
| **选定方案** | **B′**：双入口 + **Space 会话粘性**；工具条 = 明示「全局播放」出口。 |
| **Space** | 暂停/续播**当前会话**：全局会话 ↔ 全局；语段会话 ↔ 该句（含自然段尾后 **重播该句**）。Idle / 全局会话且**有选中语段** → **开该句段播**；无选中 → 开全局会话。 |
| **听跳（列表/↑↓）** | 在**语段会话**中 seek 到新句 → **开该句段播**；否则 `beginGlobalPlayback`（通读听跳）。 |
| **工具条** | 始终 `toggleGlobalPlay`：暂停时开全局；段播中 = 撕 bound **不停**变通读（出口）；全局播中 = 暂停。按钮文案/aria：**全局播放**。 |
| **不做什么** | ❌ 第二套播放引擎；❌ 段播中 Space=立刻全局续播（出口走工具条）。 |

### 4.1 能力—UI 矩阵

| 能力 | 条件 | 行为 |
|------|------|------|
| 旁侧/浮层 play | — | 切入该句 scoped；武装语段会话 |
| 语段自然结束 | scoped end | 停在段尾；**保持语段会话**；Space = 重播该句 |
| 语段播中 → Space | scoped playing | Pause；**保持语段会话**；再 Space = 续播/重播 |
| 语段会话中 → 听跳新句 | list/↑↓ seek | **开新句段播** |
| 工具条「全局」 | 任意 | 强制全局会话；**段播中撕 bound 续通读**（出口；UI 显示「改为全局通读」而非暂停） |
| Idle / 全局会话 → Space | 有选中语段 | `playSegmentAtIndex(selected)`（段播） |
| Idle / 全局会话 → Space | 无选中 | `beginGlobalPlayback` + play |
| 空白区 seek 后 → Space | 可仍有选中 chrome | **全局**从当前 playhead（`preferGlobalSpace`；点语段/听跳后恢复「有选中→段播」） |

---

## 5. 落位

| 层 | 变更 |
|----|------|
| `utils/playbackSession.ts` | `PlaybackSession` 类型 |
| `useWaveformSegmentPlaybackControls` | session ref · `pauseMediaKeepingSession` · arm on segment play |
| `useProjectWaveform` | `togglePlay` sticky · `toggleGlobalPlay` |
| `useTranscriptionLayer` | listen-jump 语段会话 → `playSegmentAtIndex` |
| `EditorWorkbenchToolbar` | 按钮「全局」+ `toggleGlobalPlay` |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] 用户确认三规则：① 段尾后 Space 重播该句 ② 新句听跳开段播 ③ 工具条明示全局播放
- [x] 旁侧 play/stop tooltip（既有）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-12 | 初版：交叉切换业内对照；签收维持 B + tooltip |
| 2026-07-12 | **改签**：B′ 会话粘性 Space + 工具条「全局播放」 |
| 2026-07-12 | **改签**：Idle/全局会话下有选中语段时 Space = 段播（无选中仍全局） |

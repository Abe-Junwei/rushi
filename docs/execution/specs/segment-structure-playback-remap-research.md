# 调研：拆合后播放身份 remap（播放头为准）

> **状态**：已采纳（用户拍板 2026-07-13）  
> **关联**：[`global-segment-playback-cross-switch-research.md`](./global-segment-playback-cross-switch-research.md)  
> **门禁**：语义以本文 §4 为准后编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 播放头在语段内时拆分/合并，再 Space / 续播应对「含播放头的新语段」可预期。 |
| 本仓现状 | 拆分固定选中右半；session/pause/autoStopped 按旧 idx；选中变化清锚点。 |
| 成功标准 | 拆合后选中与 sticky 身份跟播放头；缝上归右；暂停保留 t；播中重绑；自然停仅在仍停于新块段尾时保留「从段首重播」，合并后播放头落在段中则从 playhead 续播。 |

---

## 2. 业内对照（摘要）

| # | 路线 | 代表 | 要点 |
|---|------|------|------|
| A | 选区/clip 身份随时间线几何 | Descript / DAW | 编辑后播放仍跟 playhead 所在 clip |
| B | 列表 index 粘性 | 本仓改前 | index 漂移导致错句 |

---

## 3. 决策（用户）

1. 拆分默认选中 **含播放头** 的一半；**恰在缝上 → 右半**  
2. Space / 续播 **跟播放头所在语段**（remap session）  
3. 中段暂停：保留时刻 **t**，落到含 t 的新语段续播  
4. 播中拆合：自动改选中到含头语段并重绑 bound  
5. 自然停后拆合：若播放头仍在**新块段尾** → 保留 autoStopped（再播从段首）；若因合并落在**段中** → 清 sticky、pausedAnchor@t，再播从 playhead（与「段内从播放头续播」一致）  

---

## 4. 落位

| 层 | 模块 |
|----|------|
| 纯函数 | `utils/segmentPlaybackStructureRemap.ts` |
| 波形 | `useWaveformSegmentPlaybackControls.remapPlaybackAfterStructureChange` |
| 拆合 | split/merge 选中用 playhead；bridge 调 remap |
| Space | session 已 remap 后自然跟播放头语段 |

**不做什么**：uid 级身份系统；改 Transport seek 优先级表本身。

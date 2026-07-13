# 调研：播放时钟 API 命名对齐（权威 / 显示）

> **状态**：已采纳  
> **关联 ADR**：[0008-native-audio-playback-transport.md](../../adr/0008-native-audio-playback-transport.md) §时钟契约  
> **关联 architecture**：[desktop-waveform-engine.md](../../architecture/desktop-waveform-engine.md) §播放时钟  
> **承接**：[`waveform-playhead-single-clock-research.md`](./waveform-playhead-single-clock-research.md)、段播 pause/resume 回退修复

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 语段暂停再播时针头回退；高 zoom 更明显。根因是决策路径读了滞后权威钟，而视觉跟显示插值。 |
| 本仓现状 | ADR-0008 已定义权威 / 显示两层；前端仍用 `getRawMediaPlayheadTimeSec` 一名两义（视觉钟接 display，暂停路径接 authority）。 |
| 成功标准 | API 名与契约一致；暂停/续播 freeze 只走 display 高水位；typecheck + 定向 test 绿。 |

---

## 2. 业内对照

| # | 路线 | 机制 |
|---|------|------|
| A | ADR-0008 / 本仓 native transport | 权威 TimeUpdate + display 插值；pause latch = display 高水位 |
| B | Peaks / WaveSurfer | UI rAF 读引擎时间；seek 写引擎；无「raw」误名 |

---

## 3. 决策

| 项 | 结论 |
|----|------|
| **选定** | 重命名对齐契约：`getAuthorityPlayheadTimeSec` / `getDisplayMediaPlayheadTimeSec`；视觉钟入参改为 `getEngineDisplayTimeSec`；`resolveSegmentPlayFrom` 的 `rawMediaSec` → `authoritySec` |
| **不做什么** | 不取消插值；不造第三套时钟；不改 Transport Channel 事件模型 |
| **落位** | `useWaveformPlayback`、visual clock、segment pause/resume、transport resolve、architecture 注释 |

---

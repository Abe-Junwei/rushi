# Intent：波形 Transport Authority

> **Research**：[waveform-transport-authority-research.md](./waveform-transport-authority-research.md)  
> **Plan**：[waveform-transport-authority-plan.md](./waveform-transport-authority-plan.md)  
> **Acceptance**：[waveform-transport-authority-acceptance.md](./waveform-transport-authority-acceptance.md)  
> **状态**：编码完成（待手测 H1–H7）

## 意图

把分散的 seek / play / play-from 决策收敛为 **单一 Transport Intent 调度器**，在保留 DOM playhead + single-clock display 的前提下，消除 SC2 / display / raw 多源竞态导致的播放头正确性回归。

## 用户价值

- 播放中换语段再 Space：从新段正确位置出声
- 首点语段 / 已选 seek-within / 空白 seek 行为稳定可预期
- 暂停后选另一段再播：不以滞后 raw media 起播

## 范围

| 薄片 | 交付 |
|------|------|
| **TA-1** | research / intent / plan / acceptance |
| **TA-2** | `services/waveform/transport`：types + resolve + dispatch + 矩阵单测 |
| **TA-3** | playSegment / Space / toolbar 经 resolve play-from |
| **TA-4** | seek + select 路径对齐；禁止 SC2 推断已 seek |
| **TA-5** | engine 文档 + typecheck / 定向 test / architecture-guard |

## 不做

- 不改 WS-2a sticky / playhead 布局
- 不并入 WS-FPS / band dirty paint
- 不合并 SC1/SC2；不恢复 WS native cursor
- 不引入第二套时钟 / hit-test
- 不把 list 点击默认改成 seek

## 验证

见 acceptance；命令：`npm run typecheck && npm run test`（定向）+ `node scripts/check-architecture-guard.mjs`。

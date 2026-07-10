# Intent：波形播放头单时间源（移除外推）

> **Research**：[waveform-playhead-single-clock-research.md](./waveform-playhead-single-clock-research.md)  
> **Plan**：[waveform-playhead-single-clock-plan.md](./waveform-playhead-single-clock-plan.md)  
> **Acceptance**：[waveform-playhead-single-clock-acceptance.md](./waveform-playhead-single-clock-acceptance.md)  
> **状态**：编码完成（待手测 H1–H6）

## 意图

波形播放头与语段播放/seek **决策** 共用同一时间源：`audioprocess` / `lastTimeUiCommitRef` 锚定的 `visualTimeSecRef`，**不做 extrapolation**（对标 WaveSurfer v7 / Peaks.js）。

消除「视觉在段内、决策判定在段外 → 起播跳段头」类正确性问题，并移除为双时钟竞争服务的 suppress 窗口。

## 用户价值

- 播放中按空格 / 语段播：起播位置与播放头视觉一致
- pause 后 seek / ←→：播放头不倒退、不跳段头
- 架构与业内成熟产品一致，减少补丁层

## 范围

| 薄片 | 交付 |
|------|------|
| **PSC-1** | 移除外推；`onWsAudioprocess` 直写 `visualTimeSecRef` |
| **PSC-2** | 决策路径统一读 `getDisplayPlayheadTimeSec` |
| **PSC-3** | 删 imperative/selection suppress；播放态 seeking 不重同步；暂停态 seeking 仍 sync（WS-only seek） |
| **PSC-4** | 测试 + 文档 + 手测 |

## 不做

- 不保留 extrapolation / `max(visual, rawMedia)`
- 不引入第三套时钟
- 不改 tier 滚动真源、center/edge 跟随语义
- 不改语段 tap 产品矩阵（已选 seek-within 等）
- 不 fork 第二套 hit-test / VAD

## 验证

`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`；手测见 acceptance。

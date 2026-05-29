# Acceptance: waveform_single_scroll_consolidation

> Intent：[`waveform-single-scroll-consolidation-intent.md`](./waveform-single-scroll-consolidation-intent.md)  
> Plan：[`waveform-single-scroll-consolidation-plan.md`](./waveform-single-scroll-consolidation-plan.md)

## 机器闸门（每阶段 PR）

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

S4 合并前额外：`npm run lint`（若触及 lint 相关文件）

---

## 代码级验收

### S1 完成后（peaks 模式）

- [ ] `onWaveformScroll` **不**调用 `syncWaveformScrollPx` / 不写 tier（peaks）
- [ ] peaks 模式 `autoScroll === false`（**fallback 可仍为 true**）
- [ ] peaks 模式 tier 滚动 **不**调用 `ws.setScrollLeft`
- [ ] peaks 模式 `useWaveformZoomSync` **无**仅为 `pxPerSec` 的 `ws.load`
- [ ] 存在 `useWaveformPlaybackScrollFollow`（或等价）且只写 tier

### S2 完成后

- [ ] 波形 UI 仅 **一处** 提供 `{ scrollLeftPx, clientWidthPx }`（`useTierScrollLayout` / controller）
- [ ] 无生产引用 `useTierScrollLeftPx`、`useWaveformViewportMetrics`
- [ ] `useTranscriptionLayer` ≤ 300 行且 hooks ≤ 12

### S4 完成后（必做终态）

- [ ] peaks 路径无 `WAVEFORM_SCROLL_REVERSE_SYNC_EPSILON` 依赖（fallback 除外）
- [ ] 对外 prop 无 `committedPxPerSec` / `peaksPxPerSec` 命名；使用 `layoutPxPerSec` + `drawPxPerSec`（或等价 controller API）
- [ ] `contentKey` / tile generation **不**随 `layoutPxPerSec` 每帧变化（拖动期仅 `drawPxPerSec` 冻结）
- [ ] viewport-fit FSM 单测通过
- [ ] `desktop-waveform-engine.md` 与 ADR-0005 一致；tile **LRU cap = 24**、**overscan = 5**

### S3′ 完成后（仅当启动可选阶段）

- [ ] 主 tier peaks 由 `WaveformPeaksTileRenderer` 驱动
- [ ] React 不 `map` 动态 canvas 列表
- [ ] `WaveformPeaksTileRenderer.test.ts` 覆盖 visible range + LRU

### 未启动 S3′ 时

- [ ] 仍使用 `WaveformPeaksTileLayer` + `useWaveformTileLifecycle` 即可签收 S4

---

## 自动化测试

| 用例 | 文件 | 阶段 |
|------|------|------|
| peaks tier 滚动不调 ws.setScrollLeft | `useTierScrollApi.test.ts` 或扩展 `useTierScrollSync.test.ts` | S1 |
| peaks zoom 不触发 ws.load | `useWaveformZoomSync.test.ts` | S1 |
| fallback bridge 仍同步 | 同上或 `useWaveformDecodeScrollBridge.test.ts` | S1 |
| tier scroll layout burst / resize | `useTierScrollLayout.test.ts` | S2 |
| 拖动期 contentKey 不随 layout px 变 | `useWaveformTileLifecycle.test.ts` 或 controller 单测 | S4 |
| viewport fit FSM | `viewportFitStateMachine.test.ts` | S4 |
| tile renderer LRU / visible | `WaveformPeaksTileRenderer.test.ts` | S3′ |
| draw signature / peak identity | `WaveformPeaksTileLayer.test.ts`（保留或迁移） | S4 / S3′ |

---

## 手测矩阵

| ID | 场景 | 通过标准 |
|----|------|----------|
| H.01 | 打开 ~1min 项目 | 打开后 3s 内 peaks 可见；滚到末尾无空白 |
| H.02 | ~10min | 同 H.01；快速 fling 停滚 **无左右闪** |
| H.03 | ~21min | 同 H.02；高 zoom 扫过无持续白块 |
| H.04 | 缩放滑块 min→max→min | 拖动可接受；释放后 peaks 正确；无长时间空白 |
| H.04′ | 缩放滑块连续拖动 ≥2s | Performance：无持续全屏 tile 重画风暴；主线程不明显卡顿 |
| H.05 | 横滚到末尾再回开头 | 无闪动；playhead/语段对齐 |
| H.06 | 快速切换语段 10 次 | 每次 peaks 可见 |
| H.07 | 跟随模式播放 | 视口跟随；peaks 不消失 |
| H.08 | fit 全段 | 全段可见 |
| H.09 | 全局条 + overview | 与主区 scroll 一致 |
| H.10 | 换项目 / 换文件 | scroll 归零 |
| H.11 | 折叠全局条 | 主区 playhead 正常 |
| H.12 | 滑块外 pointerup | zoom commit 正确 |
| H.13 | 静止 10s | 无持续 60fps 空转 rAF |
| H.14 | 125% / 150% DPR | 接缝不可见 |

### 回归重点

| ID | 场景 | 通过标准 |
|----|------|----------|
| R.01 | 播放中不操作 | tier 跟随；停滚无 1–4px 回弹 |
| R.02 | peaks 加载中 zoom fit | 无「视口对、波形空」 |
| R.03 | 无 peaks / decode-fallback | WS 波形可见；scroll 可用；autoScroll 行为与改前一致 |
| R.04 | 同一项目内连续换文件 ≥3 次 | 无旧波形/peaks/scroll 残留；无错项目 peaks |

---

## 性能签收

| 指标 | 标准 |
|------|------|
| idle CPU | H.13 |
| zoom 拖动 | H.04′（`draw`/`getInterleavedPeaks` 非每帧全量 generation bump） |
| zoom commit | 单次 resample + 可见 tile 重画 |
| 横滚 | H.02（无肉眼 1–4px 抖动） |

---

## 签收记录

| 阶段 | 机器闸门 | 手测 | 签收人 | 日期 |
|------|----------|------|--------|------|
| S0 | | — | | |
| S1 | | R.01, R.03, H.02, H.05, H.07 | | |
| S2 | | H.06 | | |
| S4 | | H.01–H.14, H.04′, R.02, R.04 | | |
| S3′ | | H.01–H.03（仅若启动） | | |

**S3′ 启动/跳过记录**（必填其一）：

- [ ] 跳过：S4 后 H.02/H.03 通过，理由：________  
- [ ] 启动：失败项 ________，计划 PR：________

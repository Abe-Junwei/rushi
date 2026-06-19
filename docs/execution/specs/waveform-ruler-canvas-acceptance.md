# Acceptance：嵌入时间尺 Canvas 化

> **Research**：[`waveform-ruler-canvas-research.md`](./waveform-ruler-canvas-research.md)  
> **Plan**：[`waveform-ruler-canvas-plan.md`](./waveform-ruler-canvas-plan.md)  
> **状态**：待实施（2026-06-20）

---

## 1. 能力—UI 状态矩阵（标尺）

| UI 态 | scroll 来源 | 期望标尺行为 |
|-------|-------------|--------------|
|  idle / 暂停 | — | 刻度与波形对齐；无空白带 |
|  用户 wheel / 拖拽 tier | tier | 同帧随 band/playhead 移动；无 React commit 风暴 |
|  播放 center 跟随 | playbackFollowScroll | 刻度稳定；无拖影、无回弹（suppress 已修） |
|  播放 edge 跟随 | 同上 | 近边缘才滚；用户滚后 suppress 2.5s |
|  标尺 drag | userScrubScroll | 刻度随 scroll；seek 可选 |
|  标尺 click | seekFromTierClientX | 不重绘异常 |
|  zoom / fit-all | timelineWidth 变 | 刻度密度更新；无 0 宽闪 |
|  主题切换 accent | appearance | 刻度色随 theme；一次重绘 |

---

## 2. 自动化验收

### 必须新增

- [ ] `drawWaveformTimeRuler.test.ts` — viewport x 映射、`paddedVisibleTimeWindow` 集成、label stride
- [ ] `waveformRulerCanvasColors.test.ts` — palette resolve 非空
- [ ] `WaveformTimeRulerCanvas.test.tsx` — mount + `flushTierScrollFrameForTests` 触发 paint
- [ ] `drawWaveformTimeRuler` 禁止 DOM / `document` 查询（结构守卫或 test 约定）

### 必须更新

- [ ] `WaveformTimeRuler.test.tsx` — 改为 ink/light 或删除 embedded 用例（若 embedded 改 Canvas）
- [ ] `useWaveformTimeRulerMetrics.test.ts` — 删除或迁移为 draw 单测

### 必须删除或降级

- [ ] embedded overlay 生产路径不再使用 `translate3d` delta on tick layer
- [ ] 生产代码不再 import `useWaveformRulerScrollTrack`（测试可保留）

### 项目闸门

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

---

## 3. 手测验收矩阵

| # | 场景 | 素材 | 期望 |
|---|------|------|------|
| H1 | 打开 Editor | 1–5 min | 底边 22px 刻度可见；与语段左缘对齐抽查 |
| H2 | 快速横滚 | 30 min+ | 无刻度空白、无「慢半拍」；band 与 ruler 对齐 |
| H3 | 触控板惯性 | macOS Tauri | 惯性停止后刻度稳定 |
| H4 | 播放 center | 30 min+ | 跟随 smooth；滚轮 suppress 不回弹 |
| H5 | 播放 edge | 30 min+ | 边缘跟随；手动滚后 2.5s 内不抢 scroll |
| H6 | 标尺 drag | 任意 | scroll 跟手；无 tick 堆叠鬼影 |
| H7 | 标尺 click seek | 任意 | 播放头与点击时间一致 |
| H8 | zoom ± / 滑块 | 选中附近 | 刻度密度变化正确；无重叠糊字 |
| H9 | fit-all → zoom in | 长音频 | 无错位 |
| H10 | 切换 Office 主题色 | indigo 等 | 刻度对比度正常 |
| H11 | DevTools Performance | 快速滚 3s | 无 `WaveformTimeRuler` 高频 commit（仅 Canvas paint） |

---

## 4. 架构验收

- [ ] `desktop-waveform-engine.md` 舞台 DOM 含 `WaveformTimeRulerCanvas`
- [ ] chroming 表：标尺行改为 Canvas + `--notion-text*` palette
- [ ] 无第二套 tick 步长算法（仅 `waveformRulerTicks.ts`）
- [ ] scroll 热路径标尺与 band 同读 `resolveTierScrollLeftPx`
- [ ] `check-architecture-guard.mjs` 更新 allowlist / 禁止 embedded DOM ruler translate

---

## 5. 完成定义

- [ ] R0 纯函数 + 测试绿
- [ ] R1 Editor embedded 接 Canvas 绿
- [ ] R2 交互 + 清理 + 文档 + guard 绿
- [ ] §2 自动化全部勾选
- [ ] §3 手测 H1–H11 勾选
- [ ] §4 架构项勾选

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 初版 acceptance |

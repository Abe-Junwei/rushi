# Acceptance：波形统一原生 Scroll 舞台重构

> **Research**：[`waveform-unified-scroll-stage-research.md`](./waveform-unified-scroll-stage-research.md)  
> **Plan**：[`waveform-unified-scroll-stage-plan.md`](./waveform-unified-scroll-stage-plan.md)  
> **状态**：自动验证完成；剩余最终桌面手测矩阵（2026-06-18）

---

## 1. Spike Go / No-Go

### Go 条件

- [x] `WAVEFORM_UNIFIED_SCROLL_STAGE` spike 下，波形与 overlay 不再依赖 `translate3d(-scrollLeft)` 仍对齐。
- [x] WaveSurfer container 使用 timeline 宽或等价布局后，30min+ 音频高 zoom 快速滚动无明显右侧空白。
- [x] 播放跟随 `center` / `edge` 可只写 tier scroll 完成，不需要 WS `autoScroll`。
- [x] 语段选中、拖边界、框选新建、context menu 坐标正确。
- [x] resize / 全屏 / fit-all 不出现 0 宽首帧或 stretch 残留。
- [x] DevTools 手测中 scroll 热路径无 React commit 风暴；若有 commit，来源需登记。

> 手测记录：用户反馈「测试都正常」（2026-06-18）。

### No-Go 条件

- [ ] WS lazy 在高 zoom 下出现不可接受空白，且 `ws.setScroll` / `reRender` 无法修复。
- [ ] overlay hit-test 需要重写大半套 pointer pipeline。
- [ ] Tauri release / WKWebView 下 programmatic scroll 无法可靠触发 chrome 同步。
- [ ] 迁移收益不明显，反而增加 resize/zoom 复杂度。

---

## 2. 自动化验收

### 必须新增或更新

- [ ] `EditorWaveformPeaksStage` DOM contract：timeline content 与 viewport chrome 分离。
- [x] `useWaveformTierScroll` 或 `useTierScrollSync`：programmatic write、defer layout commit、wheel-forward sync、smooth scroll cleanup。
- [x] `WaveformViewportPlayhead.test.tsx`：scroll frame 后 viewport 坐标正确。
- [x] `useWaveformRulerScrollTrack.test.ts`：coordinator frame 后 transform/position 正确。
- [x] `drawWaveformSegmentBands.test.ts`：可见窗 / index window 不漏绘。
- [ ] overlay geometry tests：pointer clientX → time 在原生 scroll 舞台下正确。
- [x] viewport stretch/layout tests：不再写 removed mirror layers，并覆盖 zoom 后 timeline/stage/chrome 宽度同步。

### 必须删除或改写

- [x] 依赖 `positionWaveformScrollLayersByTierScroll` 的测试。
- [x] 依赖 `WAVEFORM_WS_HOST_WIDTH_PX` 的 mount/layout 断言。
- [x] 依赖 `waveformScrollLayerRef` / `overlayScrollLayerRef` 的 production tests。

---

## 3. 手测验收矩阵

| 场景 | 素材 | 期望 |
|------|------|------|
| 基础打开 | 1–5min 音频 | 波形可见、播放/暂停/seek 正常 |
| 长音频滚动 | 30min+，100+ px/s | 快速横滚无空白尾部、无明显 jitter |
| 触控板惯性 | macOS Tauri | 波形、band、overlay、ruler、playhead 对齐 |
| 鼠标滚轮 | 普通鼠标 | wheel gain 生效，无过冲到不可控 |
| 播放跟随 center | 30min+ | playhead 稳定，内容平滑滚 |
| 播放跟随 edge | 30min+ | 接近边缘才滚，用户滚动 suppress 生效 |
| zoom in/out | 选中语段附近 | 视口中心时间保持，overlay 不漂 |
| fit selection | 任意语段 | 语段完整进入视口，scroll 正确 |
| fit all / resize | 全屏与缩放窗口 | 无 0 宽、无 stretch 残影 |
| minimap 点击 | 长音频 | scroll 到目标区域，ruler/playhead 同步 |
| 语段边界拖动 | 多语段 | 拖动命中、提交边界正确 |
| 框选新建 | 空白区域 | 创建范围与视觉坐标一致 |
| context menu | 波形右键 | 菜单时间 / 语段命中正确 |
| 密集语段 | 5000+ synthetic | DOM overlay 仍少量，band 绘制不卡顿 |

---

## 4. 架构验收

- [x] 生产代码无 `positionWaveformScrollLayersByTierScroll` import。
- [x] 生产代码无 `positionWaveSurferHostByScroll` import。
- [x] 生产代码无 `WAVEFORM_WS_HOST_WIDTH_PX` 使用。
- [x] `EditorWaveformPeaksStage.tsx` 无 `waveformScrollLayerRef` / `overlayScrollLayerRef`。
- [x] `waveformViewportStretch.ts` 不再写 mirror layer width。
- [x] `desktop-waveform-engine.md` 的舞台 DOM 与实际一致。
- [x] `scripts/check-architecture-guard.mjs` 增加 mirror 禁止项或等价检查。

---

## 5. 完成定义

最终完成必须满足：

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

若存在与本任务无关的 WIP 错误，必须在收尾记录中列出：

- 错误文件
- 错误摘要
- 为什么与 unified scroll stage 无关
- 已通过的 focused tests

---

## 6. 签收

- [x] S1 spike 手测完成并记录 Go / No-Go。
- [x] S2 DOM 迁移完成自动验证。
- [x] S3 WS 宽度 / resize / zoom 收敛完成自动验证。
- [x] S4 scroll hook 瘦身完成自动验证。
- [x] S5 legacy 删除与 guard 完成自动验证。
- [ ] 手测矩阵完成。
- [x] 文档与架构守卫完成自动验证。
- [x] 项目级自动闸门完成：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`。

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-18 | 初版：Go/No-Go、自动化、手测和架构验收 |
| 2026-06-18 | S1 spike 自动验证通过，用户手测正常，标记 Go |
| 2026-06-18 | S2 DOM 迁移完成自动验证：删除 flag / 旧 JSX 分支 / mirror layer refs，更新架构文档 |
| 2026-06-18 | S3 自动验证完成：删除旧巨宽 host 常量，补充 zoom shell layout 宽度契约测试 |
| 2026-06-18 | S4 自动验证完成：删除旧 WS scroll sync API，`useTierScrollSync` 回到 guard 阈值以内 |
| 2026-06-18 | S5 自动验证完成：删除 legacy mirror helper / tests，新增 architecture guard 禁止项 |
| 2026-06-18 | 项目级自动闸门全绿：309 test files / 1513 tests passed |
| 2026-06-18 | 手测发现 overlay 拖拽回归：timeline overlay layer 宽度塌陷；已补 `timelineWidthPx` 宽度契约与 focused test |

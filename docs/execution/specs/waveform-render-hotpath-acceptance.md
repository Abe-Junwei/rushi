# Acceptance：波形渲染热路径修复

> **调研**：[`waveform-render-hotpath-research.md`](./waveform-render-hotpath-research.md)
> **plan**：[`waveform-render-hotpath-plan.md`](./waveform-render-hotpath-plan.md)
> **状态**：待执行（勾选随实现推进）

---

## 1. 行为矩阵（状态 → 期望）

| 场景 | 修复前 | 期望（修复后） |
|------|--------|----------------|
| 稳态播放（不拖标尺、不缩放） | ruler 每帧全画布重绘（零像素变化） | ruler **不重绘**（`interactionActive` 稳定为真时 deps 不变）；playhead 叠加层顺滑移动 |
| 最近刻度高亮 | 随播放逐帧重绘高亮最近 major tick | **已按用户要求直接去掉**；标尺不再消费 playhead 时间做绘制 |
| 播放开始/停止 | — | `interactionActive` 边沿翻转触发 1 次全刻度亮度切换重绘（可接受） |
| scroll（横向） | ruler 随 scroll 重绘 | 不变（保留 `subscribeTierScrollFrame` 重绘） |
| 连续 zoom | 每中间步 resample + load | 中间步用已加载 peaks 拉伸，仅稳定后 resample+load 一次 |
| zoom 稳定单次 | resample 主线程长任务（~1s） | WR-4 后：resample 在 worker，主线程无 >50ms 长任务（spike 未过则维持主线程但已被 WR-2 降频） |
| minimap resize | canvas sizing 走 `setCspLayoutRules` | 走 `setDirectLayoutStyle`；渲染不回归 |

---

## 2. 自动化验收

### WR-1 / WR-3
- [x] `WaveformTimeRulerCanvas.test.tsx`：新增「稳态播放时 `currentTimeSec` 变化不触发 `clearRect`（不重绘）」；canvas 已移除 `subscribePlayheadFrame` / `getPlayheadTimeSec` prop（编译期即禁止逐帧订阅）。
- [x] `drawWaveformTimeRuler.test.ts`：移除 `currentTimeSec` 入参与 highlight 断言；tick/label 绘制不回归（label stride、viewport 映射保持）。
- [x] `WaveformMinimapStrip` 相关测试：canvas 尺寸/渲染不回归（全量 waveform 236 测试通过）。
- [x] `node scripts/check-architecture-guard.mjs` 绿（0 错误；`setDirectLayoutStyle` 仍限 `cspElementLayout.ts`）。

### WR-2
- [x] zoom 决策单测：连续 slider/step 经 `scheduleDrawPxPerSec`（140ms）尾沿合并；`useWaveformZoom.test.ts` 断言 N 步只提交 1 次 `drawPxPerSec`（sync 层既有 dual-track 测：layout 变、draw 冻 → `ws.zoom` 有、`ws.load` 无）。
- [ ] 手测 H4：连续 zoom 中间态拉伸不白屏、稳定后清晰（待用户）。

### WR-4（条件性 · 默认不做）
- [ ] 触发条件：WR-2 后仍有 >50ms resample 长任务 **且** 用户可感卡顿。
- [ ] `peaksResampleClient` 单测（mock worker）：请求/回传/序号取消/失败回退同步路径。
- [ ] `PeakCache.test.ts`：worker 路径与同步路径产出一致（缓存键、peaks 长度）。

### 全量
- [x] `npm run typecheck` 绿
- [x] `npm run test` 绿（397 文件 / 1994 测试）
- [ ] `npm run lint` 绿（待跑；已过 ReadLints 无报错）

---

## 3. 手测（desktop dev）

- [ ] H1 播放稳态：playhead 顺滑无卡顿；`window.__rushiScrollProfile` 中 ruler 重绘计数在稳态播放 ≈ 0。
- [ ] H2 拖动标尺：高亮 major tick 正常跟随，无残影。
- [ ] H3 点击语段：定位与渲染响应明显变快（主观 + 无长任务）。
- [ ] H4 连续 zoom：中间态波形拉伸不白屏、稳定后清晰；无 ~1s 卡死。
- [ ] H5（WR-4 通过后）Performance 面板：zoom 期间无 >50ms 长任务落在 resample。
- [ ] H6 minimap resize/主题切换：总览重绘正常。

---

## 4. 文档

- [ ] `desktop-waveform-engine.md` 补「标尺静态层不随播放重绘」；WR-4 落地则补「resample off-main-thread」。
- [ ] research / plan / acceptance 三件套互链。

---

## 5. 签收

- [x] WR-1 + WR-3 完成并验证
- [x] WR-2 编码完成（手测 H4 待签）
- [ ] WR-4 spike 结论记录（默认不做；仅当 WR-2 后仍 >50ms 且用户抱怨）

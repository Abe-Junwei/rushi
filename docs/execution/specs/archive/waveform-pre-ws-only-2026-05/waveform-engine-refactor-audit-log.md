# Audit log: waveform_engine_refactor 收口轮

## 决策记录（2026-05-28）

| # | 议题 | 决策 |
|---|------|------|
| 1 | 换文件/项目时全局条 | **重置为展开** |
| 2 | peaks 路径 `ws.zoom` | **代码彻底 skip** |
| 3 | `useWaveformSegmentOverlay` 拆分 | **P6 已完成** |

## 机器基线

| 命令 | 状态 |
|------|------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ 288 tests |
| `node scripts/check-architecture-guard.mjs` | ✅ 0 errors；overlay hotspot → P6 |
| `cargo test … waveform_peaks` | ✅ 2 tests |

## 审查轴发现与处置

| 轴 | 发现 | 严重级 | 处置 |
|----|------|--------|------|
| 1 渲染 | peaks 层固定 tier + scroll 钳制绘制 | — | 已在 P3/P5′ 落地 |
| 1 渲染 | Canvas 未监听 tier resize | P2 | ✅ `WaveformPeaksCanvas` 加 ResizeObserver |
| 1 渲染 | 进度色按 col 索引而非 bar 右缘 | P3 | ✅ `x + barWidth <= progressPx` |
| 2 scroll/fit | **autoFit 时 `zoomToFitSelection` 读到 stale selectedIdx** | **P0** | ✅ `zoomToFitSegment(seg)` + 选中时用目标语段 |
| 2 scroll/fit | 选中滚动 sync+rAF 双次 | P2 | ✅ 仅 rAF 一次 |
| 2 scroll/fit | peaks 路径 skip ws.zoom | P1 | ✅ 已实现 |
| 3 语段/文本 | `normalizeSegmentList` / draft key | — | 已有单测；merge/split 手测 |
| 3 语段/文本 | 首尾语段 scroll clamp | P2 | ✅ `pxPerSec.test` 补用例 |
| 3 语段/文本 | 选中视口计划纯函数 | P2 | ✅ `selectSegmentViewportPlan` |
| 4 全局条 | 换 mediaUrl 展开 | P1 | ✅ |
| 5 Rust peaks | L0–L2 + symphonia 单测 | — | cargo 2 tests 通过 |
| 6 架构 | overlay 334 行 / 14 hooks | P2 | **P6 登记** |

## 审查跟进（2026-05-28 二轮）

| # | 发现 | 处置 |
|---|------|------|
| 1 | 列表/textarea 选中后 `focusWaveformShell` 抢焦点 | ✅ `shouldFocusWaveformShellForSelectSource` |
| 2 | peaks 晚到 WS 仍不透明绘制 | ✅ `applyWaveSurferPeaksDrawMode` + load 成功后置 `appliedPeaksRef` |
| 3 | 缩放 async load 逆序完成 | ✅ `peaksLoadSeqRef` 序列守卫 |
| 4 | 空白波形右键落到 selectedIdx | ✅ `resolveSegmentIndexAtWaveformPointer` 返回 `null` |
| 5 | waveform.css letter-spacing | ✅ 归零 |
| 6 架构 | ~~`WaveformEngine` 未接线~~ | — | ✅ 已删除 dead facade（2026-05-28） |

## 手测待填（P0）

| 指标 | 目标 | 实测 |
|------|------|------|
| 10min MP3 peaks 生成 | < 3s | |
| 打开 → peaks 可见 | 早于 decode | |
| 滑块连续拖动 | 无拉伸感 | |

## 遗留 / 下一轮

- P6：`useWaveformSegmentOverlay` 拆分 — ✅ 见 `waveform-engine-refactor-p6-overlay-split.md`
- 可选：E2E smoke（打开编辑器 → 波形 → 选语段）
- ~~`WaveformEngine` 接入或删除~~ → 已删除

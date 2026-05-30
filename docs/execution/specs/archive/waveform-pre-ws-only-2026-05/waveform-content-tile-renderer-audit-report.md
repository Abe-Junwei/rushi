# Audit: waveform content-tile peaks renderer

> 审查日期：2026-05-28  
> 基线：`a2e7694`（main，P0–P4 已合并）+ **工作区未提交**性能优化（preview/committed、`useTierScrollLeftPx`）  
> 真源：ADR-0004、`desktop-waveform-engine.md`、acceptance 三件套

## 结论

**Ship with P1** — 架构目标已达成，旧路径已清除，四闸全绿；存在 **1 项 P1 交互一致性**、**1 项 P1 性能残留** 及若干 P2 文档/测试缺口。无 P0 代码级 blocker（手测 H.01–H.14 仍须人工签收）。

---

## Round 1 — 架构与契约

| # | 检查项 | 结果 | 备注 |
|---|--------|------|------|
| 1.1 | TileLayer 在 inline-block 宽内容内 | ✅ | `EditorWaveformPane` DOM 路径正确 |
| 1.2 | 无 sticky/transform/旧补丁 | ✅ | `apps/desktop` grep 0 匹配 |
| 1.3 | tier.scrollLeft 为 UI 真源 | ✅ | `useTierScrollSync` + tile scroll hook |
| 1.4 | timeline 坐标系一致 | ✅ | `computeTimelineWidthPx` → draw / fit / PeakCache key |
| 1.5 | preview vs committed | ✅ | 已接线；**未提交** |
| 1.6 | P2 progress overlay 取消 | ✅ | 主 tier 无 peaks 进度色；playhead/ruler 独立 |
| 1.7 | engine 文档与实现 | ⚠️ P2 | §51 仍写「rAF 读 scrollLeft」，应为 `useTierScrollLeftPx` |

---

## Round 2 — 静态代码与依赖

| # | 检查项 | 结果 |
|---|--------|------|
| 2.1 | 旧符号 `apps/desktop` | ✅ 0 匹配 |
| 2.2 | props 链 committed | ✅ Layer ← Editor ← TranscriptionLayer ← Zoom |
| 2.3 | zoomDragging → ZoomSync | ✅ `useProjectWaveform` 透传 |
| 2.4 | 未提交文件 | ⚠️ `useTierScrollLeftPx.ts` + test 未 commit |
| 2.5 | architecture guard | ✅ 0 errors；4 warnings（Layer 热点已消除） |
| 2.6 | typecheck + 357 tests | ✅ |

---

## Round 3 — 测试缺口

| 行为 | 自动化 | 状态 |
|------|--------|------|
| tile 几何边界 | `tileGeometry.test.ts` | ✅ |
| LRU / generation | `useWaveformTileLifecycle.test.ts` | ✅ |
| draw fit-all floor | `waveformPeaksCanvasDraw.test.ts` | ✅ |
| preview/committed zoom | `useWaveformZoom.test.ts` | ✅ |
| drag 跳过 ws.load | `useWaveformZoomSync.test.ts` | ✅ |
| tier scroll idle | `useTierScrollLeftPx.test.ts` | ✅ 基础；无 rAF 计数 |
| follow 立即 scroll | — | **GAP** |
| preview 拉伸 draw | — | **GAP** |
| TileLayer 集成 | — | **GAP** |
| overview peaks | — | **GAP** |
| clientX 与 preview px | — | **GAP**（见 P1-1） |

---

## Round 4 — 时序与状态机

### Zoom（preview/committed）

- 拖动：`zoomDragging=true` → `useWaveformZoomSync` **跳过** `applyZoom` ✅  
- 提交：`commitZoomInteraction` → `committed=preview` → 单次 load ✅  
- `setFitPxPerSec` / `resetZoom`：双写 preview+committed ✅  
- `queueMicrotask(finishZoom)` 与 viewport fit：设计合理 ✅  

### Scroll

- `useTierScrollLeftPx`：scroll 事件 + 120ms burst；`resyncDeps` 覆盖 zoom/fit ✅  
- programmatic `setTierScrollPx`：通常触发 scroll；`resyncDeps` 兜底 ✅  
- tier↔WS 4px 反向 epsilon：保留 ✅  

### Viewport fit / follow

- `queueViewportFit` 立即 scroll + pending finalize：已落地 ✅  
- `computeSelectionFitScrollPx` 比例坐标：已落地 ✅  

---

## Round 5 — 手测矩阵

| ID | 项 | 代码审查 | 人工签收 |
|----|-----|----------|----------|
| H.01–H.03 | 打开 1min/10min/21min | 路径完整 | **待测** |
| H.04 | 滑块 min→max | 见 P1-2 | **待测** |
| H.05–H.06 | 横滚末尾 / 切语段 | 路径完整 | **待测** |
| H.07 | 跟随模式 | 时序已修 | **待测** |
| H.08–H.09 | fit / overview | — | **待测** |
| H.10 | 换项目 | resetZoom effect | **待测** |
| H.11 | global strip | overview 独立 px | **待测** |
| H.12 | slider 外释放 | blur/pointercancel 已绑 | **待测** |
| H.13 | idle 10s CPU | idle hook 已实现 | **待测** |
| H.14 | DPR | canvas DPR 逻辑一致 | **待测** |

---

## Round 6 — 性能（静态推断 + 待 Performance）

| 指标 | 改前问题 | 改后预期 | 验证 |
|------|----------|----------|------|
| ws.load 频率 | 每 slider 帧 | commit 一次 | 单测 ✅；Performance **待测** |
| idle rAF | 永久 60fps | scroll burst only | 实现 ✅；Performance **待测** |
| 拖动 canvas 重画 | 每帧 resample+draw | 仅 stretch draw | **P1-2** 仍每帧 draw |
| LRU 内存 | — | ≤16 canvas | 代码 cap=16 ✅ |

---

## 问题表

### P1 — 应修或明确接受

| ID | 问题 | 根因 | 建议 |
|----|------|------|------|
| **P1-1** | 滑块拖动期间点击/拖语段，时间映射可能偏 | `clientXToTimeSec` 用 `minPxPerSecRef`（**committed**），语段/peaks 布局用 **preview** `pxPerSec` | `useProjectWaveform` 的 interaction ref 改接 `zoom.pxPerSec`（preview）；或拖动时禁用 overlay 交互 |
| **P1-2** | 滑块拖动仍可能卡 | `WaveformPeaksTile` signature 含 `timelineWidthPx`（preview 每帧变）→ 跳过重采样但仍 **每帧 canvas 重画** | 拖动期用 CSS `transform: scaleX` 在容器层预览，或 signature 排除 preview-only 宽度变化并单独 stretch |
| **P1-3** | 审查基线分裂 | 性能优化未 commit | 先 commit，再 sign-off |

### P2 — 文档 / 测试 / 卫生

| ID | 问题 | 建议 |
|----|------|------|
| P2-1 | acceptance / intent / plan / spike 仍描述 flag、旧 layer、P2 overlay | 批量更新或加「历史阶段」注脚 |
| P2-2 | ADR-0004 §上下文 仍写「当前由 ViewportLayer」 | 改为「曾用 / 现已 tile」 |
| P2-3 | `waveform-navigation-product-decisions.md` 等仍引用 `WaveformPeaksCanvas` | 改为 TileLayer + OverviewPeaksCanvas |
| P2-4 | `desktop-waveform-engine.md` L51 rAF 表述过时 | 改为 `useTierScrollLeftPx` |
| P2-5 | localStorage 在拖动中存 preview pxPerSec | 可接受；或 commit 后再 persist |
| P2-6 | 无 TileLayer / overview 组件测试 | 补最小 render smoke（可选） |
| P2-7 | guard：`useTranscriptionLayer` 332 行 / 14 hooks | 非本重构 blocker；后续拆 controller |

### P0

无。

---

## 已确认优点

1. **范式切换彻底**：content-tile 自然滚动，删除 ~500+ 行旧路径与补丁链。  
2. **长音频 floor**：peaks 按 `timelineWidthPx` 分布，fit-all 不空白。  
3. **跟随模式**：立即 scroll + 比例 fit + microtask finishZoom。  
4. **数据层未动**：PeakCache / `.dat` / WS 播放边界清晰。  
5. **测试网**：357 tests，核心纯函数与 hook 覆盖良好。

---

## 建议后续动作（优先级）

1. **Commit** 性能优化 + 本 audit 报告  
2. **Fix P1-1**（interaction pxPerSec → preview）— 小改，高价值  
3. **手测** H.01–H.14，填签收表  
4. **评估 P1-2**（若 H.04 仍卡再动手）  
5. **文档清扫** P2-1–P2-4（单 PR，无行为变更）

---

## 机器闸门（审查时）

```
typecheck ✅ | test 357 ✅ | architecture guard 0 errors ✅ | lint 未全仓跑
```

审查人：Agent（静态 + 单测）；人工手测：**待用户签收**。

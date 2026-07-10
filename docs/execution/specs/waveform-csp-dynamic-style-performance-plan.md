# Plan：波形高频动态样式回归 CSP 直写

> 调研（顶部链接）：[`waveform-csp-dynamic-style-performance-research.md`](./waveform-csp-dynamic-style-performance-research.md)
> Acceptance：[`waveform-csp-dynamic-style-performance-acceptance.md`](./waveform-csp-dynamic-style-performance-acceptance.md)

## 目标数据流（终态）

```
播放 audioprocess / seek / scroll
  → 单帧调度（tierScrollFrameCoordinator，不变）
  → 高频几何写入：setDirectLayoutStyle(el, { transform | left | width | height })
        → element.style.setProperty(...)   ← CSP 合法，零 style recalc
  （不再经 cspNonceStyleRegistry / <style>.textContent）

低频选择器/伪类动态样式（toast、dialog 等）
  → setCspLayoutRules → nonce <style>（保留）
```

## 薄片

| # | 内容 | 落位 |
|---|------|------|
| **CSPD-1** | 新增 `setDirectLayoutStyle`（direct `el.style`，复用 kebab/单位格式化） | `utils/cspElementLayout.ts` + test |
| **CSPD-2** | playhead 迁移 direct style | `WaveformViewportPlayhead.tsx` |
| **CSPD-3** | band / ruler 迁移 direct style（含 `cspLayoutLeftPxIfChanged` 注入 setter） | `WaveformSegmentBandCanvas.tsx`、`WaveformTimeRulerCanvas.tsx`、`utils/waveformSegmentBandCanvasScroll.ts` |
| **CSPD-4** | 守卫改 allowlist（封装点例外；仍禁 `style={{}}`/`setAttribute('style')`/`cssText`） | `scripts/check-architecture-guard.mjs` |
| **CSPD-5** | 纠错 csp-harden-v1.2 断言 | `csp-harden-v1.2-style-src-attr-research.md` |
| **CSPD-6** | 续播 raw media 在段内不回退 seek | `useWaveformSegmentPlaybackControls.ts` + test |
| **CSPD-7** | 文档 | `architecture/desktop-waveform-engine.md` |

## 设计要点

- `setDirectLayoutStyle(element, rules)`：`null/""` → `removeProperty`；数值 → `formatCssValue`（复用 UNITLESS 集）+ `setProperty(kebab, v)`。
- 组件保留既有去重（`lastTransformRef` / `lastCssLeftRef`），避免同值重复写。
- registry 高频路径清退，但 `setCspLayoutRules`/registry 本体保留（低频仍用）。
- 播放续播：`playSegmentAtIndex` 无 explicit `fromSec` 且 `getRawMediaPlayheadTimeSec()` 落在语段内 → 从 raw media time 起播（不 seek 回 display）；否则从段头。

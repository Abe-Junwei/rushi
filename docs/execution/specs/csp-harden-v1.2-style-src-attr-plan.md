# Spec(plan): CSP-HARDEN v1.2 — `style-src-attr` 去 inline

> **Research brief**：[`csp-harden-v1.2-style-src-attr-research.md`](./csp-harden-v1.2-style-src-attr-research.md)
> **Intent**：[`csp-harden-v1.2-style-src-attr-intent.md`](./csp-harden-v1.2-style-src-attr-intent.md)
> **Acceptance**：[`csp-harden-v1.2-style-src-attr-acceptance.md`](./csp-harden-v1.2-style-src-attr-acceptance.md)

## 总览

```text
Phase 0  [可选] Release 探针 → violation 清单
Phase 1  cspNonceStyleRegistry + 守卫 allowlist
Phase 2  主题 / 进度 / 静态高度 / toast
Phase 3  语段虚拟列表
Phase 4  波形 imperative (stretch/surfer/mount/ruler track)
Phase 5  波形 JSX 组件
Phase 6  Popover / menu / draggable
Phase 7  tauri.conf 切换 + 守卫收紧 + 全量手测
```

**日历估算（单人）**：约 **2–2.5 周**（10–12 片 × 2–4h），波形 Phase 4–5 占 **~40%**。

---

## Phase 1 — 基础设施 `CSP-ATTR-1`

### 新增 `apps/desktop/src/utils/cspNonceStyleRegistry.ts`

```typescript
// 职责：scopeId → 单个 <style id="rushi-csp-scope-{scopeId}" nonce={readTauriStyleCspNonce()}>
// API（示意）：
//   upsertScopeRules(scopeId: string, cssText: string): void
//   removeScope(scopeId: string): void
//   useCspScope(scopeId: string, cssText: string | null): void  // React effect 封装
```

- 创建时：`nonce = readTauriStyleCspNonce()`；无 nonce 时 **dev 回退**（`import.meta.env.DEV` 允许直接写 attr，或 no-op + console warn）
- 合并：同 scope 多次 upsert **替换** `textContent`（不 append 多 `<style>`）
- 单测：mock `document.head`、nonce 缺失、scope 覆盖/删除

### 守卫（本片仅加 allowlist，还不拦 src）

- `scripts/check-architecture-guard.mjs` 新增 `checkInlineStyleDebt()`：
  - 扫描 `apps/desktop/src/**/*.{ts,tsx}`（排除 `*.test.*`）
  - 命中 `style={{` 或 `.style.` → **warning**（计数）；维护 `INLINE_STYLE_ALLOWLIST` 随迁移缩减
- **不**改生产 CSP（本片可合并 main）

---

## Phase 2 — 低动态组件 `CSP-ATTR-2`

### 迁移策略对照

| 模式 | 现况 | 目标 |
|------|------|------|
| 有限 preset 色 | `EnvAppearancePanel` `backgroundColor: preset.*` | `data-accent={preset.id}` + `office-accent-themes.css` |
| 主题 token | `officeAccentTheme.ts` `root.style.setProperty('--zen-*')` | 同上；`applyOfficeAccentTheme` 只切 `data-accent-theme` |
| 进度 `%` | `PanelAsyncProgress`、`EnvLocalAsr*` `width: ${n}%` | `transform: scaleX(n/100)` + `origin-left` **或** registry scope `progress-{id}` |
| 固定常量高 | `ResizeBottomHit`、`EditorWaveformPane` height 常量 | Tailwind 任意值改 **token class** 或 CSS var 在 `tokens.css` |
| CSS var 引用 | `ToastHost` `bottom: toastBottomInsetCssVar()` | class + `:root { --toast-bottom-inset: … }` 已在 tokens；删 inline |
| Grid 列数 | `WelcomeSidebar` `gridTemplateColumns: repeat(n)` | registry scope `welcome-footer` 一条规则 |

### 文件清单（Phase 2）

| 文件 | 行内属性 | 迁移动作 |
|------|----------|----------|
| `services/ui/officeAccentTheme.ts` | 13× `setProperty` | → 静态 CSS + `dataset` |
| `components/EnvAppearancePanel.tsx` | 3× `backgroundColor` | → preset class |
| `components/PanelAsyncProgress.tsx` | `width` | → scaleX |
| `components/envLocalAsr/EnvLocalAsrModelCard.tsx` | `width` | → scaleX |
| `components/envLocalAsr/LocalAsrRuntimeInstallPanel.tsx` | `width` | → scaleX |
| `components/ResizeBottomHit.tsx` | `height` | → class |
| `components/ToastHost.tsx` | `bottom` | → class |
| `components/WelcomeSidebar.tsx` | `gridTemplateColumns` | → registry |
| `components/FloatingPanelSegmentList.tsx` | `height`, `maxHeight` | → class + clamp in CSS |
| `components/HoverRevealText.tsx` | `transform`, `transition` | → registry scope per instance 或 CSS `@keyframes` + class toggle |

**新增 CSS**：`apps/desktop/src/styles/office-accent-themes.css`（由 `config/officeAccentThemes.ts` 值映射，禁止 hex 漂移）

---

## Phase 3 — 语段虚拟列表 `CSP-ATTR-3`

| 文件 | 属性 | 迁移动作 |
|------|------|----------|
| `editor/EditorSegmentList.tsx` | `height`, `position`, `transform translate3d` | scope `segment-list-virtual`：`[data-segment-list-root] { height: … }` + inner translate |
| `SegmentTextListRow.tsx` | `minHeight` | CSS var `--segment-row-min-h` via registry on list scope |
| `segmentRow/SegmentRowTimestampColumn.tsx` | `width: metaWidth` | `--segment-meta-width` on list scope |
| `segmentRow/SegmentRowTextField.tsx` | `textStyle`, `minHeight`, `maxHeight` | 字体已在 class；高度走 row scope vars |

**回归**：`segmentListVirtualWindow*.test.ts`、`useEditorSegmentListScroll` 相关；手测大列表 scroll + 选中不跳。

---

## Phase 4 — 波形 imperative `CSP-ATTR-4`

> 风险最高；**先于** Phase 5 JSX，保证 resize 事务仍同步。

| 文件 | `.style.` 用法 | 迁移动作 |
|------|----------------|----------|
| `utils/waveformViewportStretch.ts` | `width` ×5 | registry scope `waveform-layout` 单条多 selector 规则；或 `:root`/layout root 上 CSS vars `--wf-timeline-w` 等 **经 registry 写** |
| `utils/waveformViewport.ts` | `setProperty(WAVEFORM_TIER_VIEWPORT_WIDTH_VAR)` | 同上 |
| `hooks/useProjectWaveformMount.ts` | `width`, `transform` | registry |
| `services/waveform/waveformSurferProgressCoverage.ts` | `clipPath`, `width`, `overflow`, `transform`, `display` | 优先 **class toggle**；连续值 registry scope `ws-progress` |
| `hooks/useWaveformRulerScrollTrack.ts` | scroll/sync 相关 style | registry |
| `hooks/useDraggablePanelPointerDrag.ts` | drag 位置 | Phase 6 一并 |
| `hooks/useWaveformHeightSync.ts` | `backgroundColor` | class |
| `components/WaveformSegmentBandCanvas.tsx` | canvas `width/height` | **保留**：canvas 元素 attribute 是否受 style-src-attr 管？→ **Spike**：若拦则改 canvas `width/height` **属性**非 style |
| `components/WaveformMinimapStrip.tsx` | `.style` + JSX | Phase 5 |
| `components/WaveformViewportPlayhead.tsx` | `.style.left` | registry |
| `utils/waveformThemeColors.ts` | probe 元素 style | 测试/probe：改 **off-DOM** 或 class 探测 |

**性能**：registry upsert 在 resize 事务内 **合并为一次** `textContent` 写（与现有 microtask coalesce 对齐）。

---

## Phase 5 — 波形 JSX `CSP-ATTR-5`

| 文件 | 属性 |
|------|------|
| `editor/EditorWaveformPeaksStage.tsx` | height ×3, tierViewportWidthStyle, transform |
| `editor/EditorWaveformPane.tsx` | height |
| `WaveformTimeRuler.tsx` | width, height |
| `WaveformTimeRulerTickLayer.tsx` | left, transform |
| `WaveformMinimapStrip.tsx` | left, width |
| `WaveformSegmentRegionItem.tsx` | left, width, top |
| `WaveformSegmentPlaybackControls.tsx` | left, width, bottom |

统一 layout root：`data-waveform-layout-root` + scope `waveform-layout`（与 Phase 4 共用）。

---

## Phase 6 — 浮层定位 `CSP-ATTR-6`

| 文件 | 属性 | 策略 |
|------|------|------|
| `SegmentContextMenu.tsx` | left, top | scope `ctx-menu-{uuid}` |
| `segmentRow/SegmentCorrectPopover.tsx` | left, top | 同上 |
| `glossary/GlossaryToolbarOverflowMenu.tsx` | fixed overlay + top/left | scope |
| `editor/WorkbenchOverflowMenu.tsx` | fixed inset + top/left | scope |
| `DraggableResizablePanel.tsx` | left, top, width, height | scope `draggable-panel` 高频更新 |

---

## Phase 7 — CSP 切换与守卫 `CSP-ATTR-7`

### `tauri.conf.json`

```json
// 生产 csp：删除整行 "style-src-attr": "'unsafe-inline'"
// devCsp 新增（DX）：
"style-src-attr": "'unsafe-inline'"
```

### `checkTauriProductionCsp()` 扩展

- 生产 `csp['style-src-attr']` 含 `unsafe-inline` → **error**
- 生产存在 `style-src-attr` 且为 `'none'` 或缺失（回退 style-src）→ OK

### `checkInlineStyleDebt()` 收紧

- allowlist 为空；任何 `style={{` 或 `.style.`（排除 allowlist 测试 helper）→ **error**

### 文档

- 更新路线图 §10.5 v1.2 CSP 行 → ✅
- §13.3 刷新

---

## 禁忌（同 v1.1）

- **勿** 本片与 Welcome 全文检索 / BATCH / DELIV 大 UI 同 PR
- **勿** Phase 7 切换 CSP 早于 Phase 2–6 代码合并
- **勿** 引入 `dangerouslySetInnerHTML` 绕 CSP

---

## 回滚

1. 恢复 `tauri.conf.json` `style-src-attr: 'unsafe-inline'`
2. Revert registry 迁移 commits（按 Phase 逆序）
3. 守卫 allowlist 临时恢复

---

## 文件索引（全仓债务快照 2026-06-18）

### React `style={{`（25 文件 · 35 处）

见 research；Phase 2–6 全覆盖。

### Imperative `.style.`（生产 · 非 test）

| 文件 | Phase |
|------|-------|
| `officeAccentTheme.ts` | 2 |
| `waveformViewportStretch.ts` | 4 |
| `waveformViewport.ts` | 4 |
| `useProjectWaveformMount.ts` | 4 |
| `waveformSurferProgressCoverage.ts` | 4 |
| `useWaveformRulerScrollTrack.ts` | 4 |
| `useDraggablePanelPointerDrag.ts` | 6 |
| `useWaveformHeightSync.ts` | 4 |
| `WaveformSegmentBandCanvas.tsx` | 4 spike |
| `WaveformMinimapStrip.tsx` | 4–5 |
| `WaveformViewportPlayhead.tsx` | 5 |
| `waveformThemeColors.ts` | 4 |
| `toastLayout.ts` | 2 |
| `transcriptSelection.ts` | 3（若有） |

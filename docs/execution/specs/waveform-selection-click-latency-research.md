# 调研：语段点选延迟（SEL-1）— React SC1 commit 与 profile 缺口

> **状态**：SEL-1a/1b/1c 编码完成 · 待手测复验（SEL-1c 后）
> **关联 spec**：[`waveform-selection-click-latency-plan.md`](./waveform-selection-click-latency-plan.md) / [`waveform-selection-click-latency-acceptance.md`](./waveform-selection-click-latency-acceptance.md)
> **前序**：
> - [`list-keyboard-navigation-virtual-scroll-performance-research.md`](./list-keyboard-navigation-virtual-scroll-performance-research.md)（LKB：burst 内 0 SC1；keyup `startTransition`）
> - [`selection-chrome-bus-research.md`](./selection-chrome-bus-research.md) / architecture [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) §选中时钟
> - 2026-07-10 手测：脏区重绘后 `bandPaint≈0`，62 段点选仍 `total≈300–550ms`
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 点击波形语段 / 列表行后，高亮与列表跟手慢；体感 0.3–0.7s |
| 本仓现状 | SC2 chrome 已 imperative（~1ms）；`bandPaint` 脏区后 ≈0ms。慢在 **同步 SC1 `setSelectedIdxUi`** → Editor/List 整树 reconcile。`useSelectedIdxCommitter` 对 `waveform`/`list` **故意同步** commit，与 architecture「SC2 → SC1 `startTransition`」不一致。profile 常报 `syncPathTotal=0`（预览路径 / flush 时机缺口） |
| 成功标准 | 62 段鼠标点选：视觉高亮 <50ms；`selection-profile total` ≤150ms 或 `listCommit` 可解释且 ≤80ms；空格起播仍读 chrome/display，不读滞后 React idx |

### 实测（2026-07-10，脏区修复后）

| 场景 | total | syncPath | bandPaint |
|------|-------|----------|-----------|
| 23 段 waveform 点选 | ~112–125ms | 0 | 0–1ms |
| 62 段 waveform 点选 | ~338–555ms | 0 | 0 |
| 62 段 list 点选 | ~303–604ms | ~0–1（listScroll≈30ms） | 0 |
| 62 段 waveformKeyboard | ~33–42ms | ~15–21 | — |

结论：绘制已不是主因；**SC1 React commit** 是主因。LKB 已证明「chrome 先行 + 延后 SC1」可行。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 / 本仓对照 |
|---|------|------|----------|-----------------|
| A | **视觉态与逻辑态分离** | Descript / Premiere 类时间线；本仓 LKB | 指针反馈走 imperative overlay；文档/选中真源延后 commit | LKB research；chrome bus |
| B | **`startTransition` 低优更新** | React 18 Concurrent | 紧急 UI 不阻塞；选中索引作 transition | [React startTransition](https://react.dev/reference/react/startTransition) |
| C | **行级订阅 / 细粒度 store** | Virtuoso / 本仓 `useSegmentRowSelection` | 父列表不因 primary 变而整表 reconcile | selection-chrome-bus |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 |
|------|--------|----------|------|
| A LKB 模式 | **高** | burst 内 0 SC1；keyup transition；chrome primary 决策 | 鼠标路径尚未套用 |
| B startTransition | **高** | `useSelectedIdxCommitter` 已对非 list/waveform 源使用 | 须保证 seek/空格读 chrome 非 React idx |
| C 行级订阅 | **中** | U13 memo 已去 selectedIdx；U11/U12 未完 | 本薄片可做最小收窄，不全做 Phase 4 |

**本仓已有模块（禁止第二套真源）**：

- `selectionChromeStore` / `paintSelectionChrome` — SC2
- `useSelectedIdxCommitter` — SC1 提交闸门（本轮改这里）
- `useTranscriptionLayerSelection.selectSegmentAt` — 选中内核
- `selectionLatencyProfile` — 观测

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **SEL-1a** 补齐 profile → **SEL-1b** waveform/list 点选对齐 architecture：SC2 先行 + SC1 `startTransition` → **SEL-1c** 最小列表 reconcile 收窄（复用 LKB U11/U12 能落地的部分） |
| 不做什么 | ❌ 不重做虚拟列表；❌ 不改 seek/reveal 语义；❌ 不恢复 extrapolation；❌ 本轨不修 WS canvas fps |
| 与 architecture 关系 | **对齐** `desktop-waveform-engine.md` 已写的「SC2 → SC1 startTransition」；修实现漂移 |
| 风险 | RISK-01：transition 期间 React idx 滞后 → 决策必须读 chrome/display；RISK-02：与 LKB burst 双策略 → 统一经 committer |

---

## 5. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| profile | `selectionLatencyProfile.ts`、`useEditorSegmentListScroll.ts` | listCommit / bandPaint / 预览路径 flush |
| commit | `useSelectedIdxCommitter.ts` | waveform/list → `startTransition`（或与 LKB 同构的 defer） |
| selection | `useTranscriptionLayerSelection.ts` | 确认顺序：SC2 → reveal/seek → SC1 transition |
| list（可选 1c） | Editor list memo / chrome 订阅 | 减少 selectedIdx 驱动的父级 reconcile |

---

## 6. 签收

- [x] 调研 brief 完成（含手测证伪 + 与 LKB/architecture 对齐）
- [x] plan / acceptance 已链接
- [x] 用户确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-10 | 初版：脏区后剩余延迟 = SC1 commit；采纳 transition + profile 补齐 |

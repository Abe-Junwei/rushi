# Spec: B14 — 边界吸附 + 修饰键

> **状态**：✅ 已实施
> **关联**：[`fix-backlog.md` B14](./waveform-audit-2026-05/fix-backlog.md)、[`segment-overlap-policy.md`](../segment-overlap-policy.md)（B13）

## 背景

框选新建与语段拖拽/resize 目前按指针原始时间落位，无吸附；B13 重叠策略已具名但未暴露到 UI。横向调研建议：靠近相邻语段边界或 playhead 时吸附；修饰键控制行为。

## 目标（本轮）

1. **边界吸附**（纯函数）：packable 语段边界 + playhead + 轨道 0/duration；阈值可测。
2. **Alt**：按住时**关闭**吸附（精细调整）。
3. **Shift + 框选新建**：重叠策略切为 B13 `allow`（默认仍为 `trim`）。
4. 修饰键与吸附逻辑集中在 `segmentOverlayModifiers` / `segmentTimeSnap` + `useWaveformSegmentDrag`，组件不散落。

### 不做（本轮）

- 拖拽 resize 统一改为 B13 reject/allow（仍用 clamp-to-neighbors）。
- 设置页持久化吸附开关。

## 设计

- `collectSegmentSnapTargets` — 收集吸附目标（排除正在编辑的语段）。
- `snapTimeSec` / `snapSegmentRange` / `applySnapToDragBounds` — 按 mode 吸附。
- `resolveSnapThresholdSec(timelineWidthPx, durationSec)` — 8px 等效阈值。
- `isSegmentSnapEnabled({ altKey })` → `!altKey`。
- `resolveCreateOverlapPolicy({ shiftKey })` → shift ? `"allow"` : `"trim"`。
- `useWaveformSegmentDrag` 在 create / move / resize 的 move 与 finish 路径应用吸附；create finish 透传 `overlapPolicy`。

## 验收

1. 纯函数测试：吸附阈值内/外、Alt 关闭、Shift→allow、move 保持 span。
2. `onCreateRange(lo, hi, { overlapPolicy: "allow" })` 在 Shift 框选时可创建重叠语段。
3. 默认（无 Shift）框选行为不变。
4. 全量闸门通过。

## 完成定义

- [x] 纯函数 `segmentTimeSnap` + `segmentOverlayModifiers`；`useWaveformSegmentDrag` 接线；`EditorWaveformPane` 透传 `playheadSec`
- [x] 测试（吸附 / Alt / Shift→allow / overlay actions 透传）+ 全量闸门：520 vitest、lint 0 error、架构守卫 0 error
- [x] Shift+框选 → `insertSegmentFromTimeRange(..., policy: "allow")`；Alt → 关闭吸附

## 修饰键约定

| 键 | 框选新建 | 拖拽 / resize |
|---|---|---|
| （无） | trim 重叠策略 + 边界吸附 | 边界吸附 |
| **Alt** | 关闭吸附（重叠策略仍 trim） | 关闭吸附 |
| **Shift** | allow 重叠策略（仍吸附除非 Alt） | 仍吸附（除非 Alt）；不改变重叠策略 |
| **Alt+Shift** | reject 重叠策略 + 关闭吸附 | 关闭吸附 |

> 修饰键提示通过 overlay 的 `title` 暴露给用户（hover 可见）。

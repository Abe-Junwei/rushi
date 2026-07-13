# Spec: B13 — 重叠策略升为「一等模式」

> **状态**：✅ 已实施（create 路径 + drag 吃邻）
> **关联**：[`fix-backlog.md` B13](./waveform-audit-2026-05/fix-backlog.md)、[`desktop-waveform-engine.md` §语段语义真源](../../architecture/desktop-waveform-engine.md)

## 背景

当前重叠处理散在两处、各用一套**隐式**策略：

- **框选新建** `insertSegmentFromTimeRange` → `clampCreateRangeClearOfSegments`：裁剪进空隙，放不下则 `null` → 报「选区与已有语段重叠」。即隐式的 **trim → 否则 reject**。
- **拖拽 / resize**（历史）：夹到相邻语段边界（`max(prev.end)` / `min(next.start)`），从不拒绝。即隐式的 **clamp-to-neighbors**。

策略写死、未命名、不可选，且两路语义不一致，难以扩展（如「允许重叠分 lane」「按住修饰键强制重叠」）。

## 目标（本轮范围）

把**框选新建**的重叠策略抽成一等、具名、纯函数可测的 `SegmentOverlapPolicy`，默认行为**不变**：

| 模式 | 语义 |
|----|----|
| `trim`（默认） | 裁剪进相邻空隙；放不下返回 null（= 现行行为） |
| `reject` | 任一重叠即拒绝（不裁剪），否则按原范围创建 |
| `allow` | 允许重叠，按原范围创建（由 `assignSegmentOverlapLanes` 垂直分 lane 呈现） |

### 后续已补：drag 吃邻（eat-then-delete）

波形 `resize-start` / `resize-end` 越过邻段时：

1. **推动邻段边界**（右拖推 `next.start`，左拖推 `prev.end`）。
2. 邻段剩余跨度 < `WAVEFORM_SEGMENT_MIN_SPAN_SEC` 时 **删除邻段**，当前段继续扩张；可链式吃多个邻段。
3. `move` 仍为 hard clamp-to-neighbors（不吃、不删）。
4. 单次手势一次 undo（`updateSegmentBounds(..., options)`）。
5. 含删除时：先 `commitTextDraftsForStructureMutation`，再 `dispatchTranscriptApplySegments`（CM6 开）+ `publishStructure`；禁止只靠 SyncMeta（行数变化时为 no-op）。
6. live 预览的吃邻判定使用与 commit 相同的 `WAVEFORM_SEGMENT_MIN_SPAN_SEC`，避免 pointerup 才从 push 翻成 delete。

纯函数：`resolveResizeEatAgainstNeighbors` / `finalizeSegmentOverlayBoundsEat`（`segmentGapPolicy.ts`）。

### 不做（原 B13 范围）

- 不接 UI / 修饰键切换 create 模式（属 B14：吸附 + 修饰键）。

## 设计

新增纯函数（`segmentTimeRange.ts`），在现有 `clampCreateRangeClearOfSegments`（即 `trim` 实现）之上分发：

```ts
export type SegmentOverlapPolicy = "trim" | "reject" | "allow";

export function resolveCreateRangeForPolicy(
  segments: ReadonlyArray<{ start_sec: number; end_sec: number }>,
  rawLo: number,
  rawHi: number,
  policy: SegmentOverlapPolicy = "trim",
  minSpanSec?: number,
): { startSec: number; endSec: number } | null;
```

- `trim` → 委托 `clampCreateRangeClearOfSegments`。
- `reject` → 任一 `segmentTimeRangesOverlap` 为真则 `null`；否则 `{round(lo), round(hi)}`。
- `allow` → 始终 `{round(lo), round(hi)}`（仅校验 min span，过短返回 null）。

`insertSegmentFromTimeRange` 增加可选参数 `policy: SegmentOverlapPolicy = "trim"`，其余不变（仍先做过短检查、仍用 `selectPackableSegments` 过滤占位、`null` → 报重叠）。默认参数保证现有调用零行为变化。

## 验收

1. `resolveCreateRangeForPolicy` 三模式纯函数测试：
   - `trim` 与 `clampCreateRangeClearOfSegments` 等价（裁剪 / 放不下 null）。
   - `reject` 重叠即 null、无重叠按原范围。
   - `allow` 重叠也返回原范围、仅过短才 null。
2. `insertSegmentFromTimeRange` 默认（trim）行为与现有测试一致，不回归。
3. `insertSegmentFromTimeRange(.., policy="allow")` 可在已有语段区间内创建重叠语段。
4. resize 吃邻：越过边界推动邻段；压破 minSpan 则删除；链式多邻；`move` 不吃邻。
5. 全量闸门通过（typecheck / vitest / lint 触及文件 / 架构守卫）。

## 落位文件

- `apps/desktop/src/utils/segmentTimeRange.ts` — `SegmentOverlapPolicy` + `resolveCreateRangeForPolicy`
- `apps/desktop/src/utils/segmentGapPolicy.ts` — `resolveResizeEatAgainstNeighbors` / `finalizeSegmentOverlayBoundsEat`
- `apps/desktop/src/pages/useSegmentMutationController.ts` — create policy + bounds eat commit
- `apps/desktop/src/hooks/waveformSegmentDragHelpers.ts` — drag 预览/提交吃邻
- 测试：`segmentTimeRange.test.ts`、`segmentGapPolicy.test.ts`、相关 mutation / drag helpers

## 完成定义

- [x] 三模式纯函数 `resolveCreateRangeForPolicy` + 控制器接线（`insertSegmentFromTimeRange` 增可选 `policy`，默认 `trim`）
- [x] 测试（三模式纯函数 + 默认 trim 不回归 + allow 重叠创建）
- [x] drag 吃邻（推动邻段 / minSpan 删除 / 链式 / 单 undo）
- [x] 全量闸门：TS typecheck + vitest 触及文件 + 架构守卫

## 实施附记

- 默认 `trim`：所有现有 create 调用零行为变化（`EditorWaveformPane` 未传 policy）。
- 暴露模式（修饰键 / 设置切 `allow`/`reject`）属 **B14**；本轮只落「一等具名策略 + 可测分发」的地基。
- drag 已从纯 clamp-to-neighbors 升级为 resize **eat-then-delete**；`clampSegmentBoundsToNeighbors` 仍用于 move 与非 eat 的 bounds 提交。

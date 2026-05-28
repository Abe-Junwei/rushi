# P6：`useWaveformSegmentOverlay` 拆分

**状态**：✅ 已实施（2026-05-28）

## 触发原因

- `apps/desktop/src/hooks/useWaveformSegmentOverlay.ts`：334 行，14 个 hook/effect
- `check-architecture-guard.mjs` hotspot warning（>300 行 / >12 hooks）

## 切刀结果

1. **几何 / hit-test / draft 边界** → `utils/waveformSegmentOverlayGeometry.ts`
2. **pointerup 分派** → `utils/waveformSegmentOverlayActions.ts`
3. **pointer 拖拽状态机** → `hooks/useWaveformSegmentDrag.ts`
4. **薄组装** → `hooks/useWaveformSegmentOverlay.ts`

## 验收

- [x] 行为与 P4 手测一致（边界拖、move、create range、双击播放）— 逻辑平移 + 单测
- [x] guard 无 overlay hotspot warning
- [x] 不新增第三层 panel border

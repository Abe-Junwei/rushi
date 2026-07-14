# 计划：语段筛选全链路修复

> **调研门禁**：[`transcript-editor-core-remediation-research.md`](./transcript-editor-core-remediation-research.md)（P9a 筛选链路既有结论仍有效；本轮为缺陷/性能修复，不另立调研）。  
> **验收**：[`segment-filter-chain-remediation-acceptance.md`](./segment-filter-chain-remediation-acceptance.md)  
> **关联**：[`transcript-editor-core-remediation-plan.md`](./transcript-editor-core-remediation-plan.md) §P9a（本修复收口其遗留缺陷）  
> **状态**：实现完成；手测待签收

---

## 0. 行为契约

- 筛选只控制文本行、波形 band 与可交互语段；不改 `SegmentDto[]`、保存/导出、全局播放遍历。
- 被筛除的当前 primary 保留波形视觉 chrome 和列表 banner，但为视觉只读：不可拖边界、右键命中、lasso 命中或触发段操作；清除筛选后恢复。
- 冻结段仍允许 scoped playback；冻结只阻止编辑/结构修改并影响全局播放与交付导出。
- CM6 继续是会话内文本/结构/选区真源；React filter state 是筛选条件真源；其他 Set/Map 均为可丢弃派生投影。

---

## 1. 统一筛选投影与结构事务

| 落位 | 改动 |
|------|------|
| `segmentListFilter.ts` | 共享 matcher（DTO + CM meta 投影） |
| `segmentMetaField.ts` / `structureCommands.segmentDtoToMeta` | 最小投影补 `hasAnnotation` |
| `filterLineVisibility.ts` | 存 criteria + visibleSet + hiddenRuns + generation；文本编辑按 runs O(r) 重建 |
| `structureCommands.ts` | 同 TX 用 `nextSegments` + criteria 重算可见性 |
| `useSegmentListFilter.ts` | 一次 memo 返回 indices / Set / position Map / isTrueSubset |

## 2. 热路径

| 落位 | 改动 |
|------|------|
| `waveformSegmentBounds.ts` | 去掉全段循环内 `findIndex` → O(n) |
| `selectionDecorations.ts` | 仅遍历 selected + primary → O(k) |
| `frozenLineDecorations.ts` | 缓存 frozen indices；文本编辑 O(k) |
| `segmentListFilterNav` / keyboard / scroll | Set/Map；删 DOM attribute 数据总线 |

## 3. Reveal 所有权

- `TranscriptEditorCore`：合并 filter effect；`setState` 后先恢复 filter 再唯一 reveal。
- `revealSegment*`：可取消 generation 调度；用户 wheel/pointer 后取消旧任务。

## 4. 波形契约

- 统一消费 `visibleIndexSet`：hit / contextmenu / lasso / drag / overlay。
- Hidden primary：视觉 chrome only。
- Frozen 多选非 primary：较弱 callout cue。

## 5. 验证

见 acceptance：定向单测、1k/3k/10k 基准、门禁、真实工程手测。

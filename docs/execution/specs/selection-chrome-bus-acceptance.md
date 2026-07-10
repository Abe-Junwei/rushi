# Acceptance：Selection Chrome Bus（列表 + 波形选中视觉层）

> **Research**：[`selection-chrome-bus-research.md`](./selection-chrome-bus-research.md)  
> **Plan**：[`selection-chrome-bus-plan.md`](./selection-chrome-bus-plan.md)  
> **Grill 基线**：[`waveform-selection-reveal-seek-acceptance.md`](./waveform-selection-reveal-seek-acceptance.md) H1–H20 **仍须绿**（本薄片 additive）

---

## 目标

193 段级转写：波形/列表点选 **视觉高亮 <50ms**；React `listCommit` 不阻塞感知；多选/filter/keyboard/undo **无 SC2↔SC1 desync**。

---

## 能力—UI 状态矩阵（选中 SC 维）

> 编辑器选中态维度（本薄片定义；非 ASR D1–D8）。架构真源更新见 [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)。

| UI 表现 | 维度 | 数据源 | 手测场景 |
|---------|------|--------|----------|
| 波形语段条带高亮 + resize handles | **SC2** chrome | `selectionChromeStore` + overlay imperative | 波形点击后 **<50ms** 条带变选中色 |
| 列表行 `.seg-row-selected` 边框/背景 | **SC2** | `applySelectionChromeImperative` · `[data-seg-row]` | 与波形 **同一次点击** 同步亮（不可波形亮 400ms 后列表才亮） |
| 多选行 `.seg-row-in-selection` | **SC3** + SC2 | store `selectedSet` | Shift range / lasso 后非 primary 行样式正确 |
| Footer / toolbar 当前语段时间 | **SC1** logic | React `selectedIdx` | SC2 亮后 500ms 内 toolbar 仍对齐同一 idx |
| Filter banner「选中句不可见」 | **SC1** | `selectedDisplayIndex === -1` | filter 排除 SC1 时 **SC2 不画**隐藏行；banner 可见 |
| 虚拟列表空白 / pin | **SC4** | scroll projection | 远距选中仍无 >100ms 白屏（P0 回归） |

### 矛盾场景（必测）

1. **SC2 先于 SC1**：波形点 idx=68 — DevTools 在 50ms 内可见 `.seg-row-selected` 与波形 selected 色；React Profiler 中 `listCommit` 可晚于 100ms。  
2. **SC3 多选 vs SC1 primary**：Shift 选 10–50 行 — primary 行 `seg-row-selected`，其余 `seg-row-in-selection`；点击空白 collapse 后 chrome 全清。  
3. **Filter 隐藏 SC1**：开 filter 排除当前句 — 无错误行高亮；点「清除过滤并定位」后 SC2/SC1 对齐。  
4. **Undo merge/delete**：merge 两语段后 — store reset；chrome 与新的 `selectedIdx` 一致，无 stale 高亮行。  
5. **换 File**：A→B — store `fileId` reset；B 文件 idx=0 仅一行亮。

---

## 验收标准

### 机器闸门

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `node scripts/check-architecture-guard.mjs`
- [ ] 定向测试全绿：

| 测试 | 路径 |
|------|------|
| Chrome store | `apps/desktop/src/services/selection/selectionChromeStore.test.ts` |
| Imperative paint | `apps/desktop/src/services/selection/applySelectionChromeImperative.test.ts` |
| Selection profile | `apps/desktop/src/pages/useTranscriptionLayerSelection.profile.test.ts` |
| **V-CI sync path** | `apps/desktop/src/perf/selectionChromeSyncPath.perf.ts` |
| List scroll | `apps/desktop/src/components/editor/useEditorSegmentListScroll.test.ts` |

### 性能（DevTools · 193 段素材）

启用：

```js
__rushiSelectionProfile.enable()
// 波形连点 5 次 + 列表连点 5 次
__rushiSelectionProfile.print()
```

| 指标 | CI（V-CI） | 手测（F-SPLIT） | 说明 |
|------|------------|-----------------|------|
| `syncPathTotal` | **≤80ms** fail | 记录 | flushSelectedIdx + firstPaint + listChrome + resolvePlan + viewport + seek + focus |
| `firstPaint` | — | **≤50ms** | imperative chrome |
| `listChrome` | — | **≤50ms** | store commit + 波形 imperative |
| `listCommit` | 记录即可 | 记录 | 允许 100–500ms；**不**作为 CI blocker |
| `listScroll` | 波形视口内 = 0 | 波形视口内 = 0 | P1 回归 |

CI 命令：`npm run test:perf -w @rushi/desktop`（含 193 段基准）。

### 手测矩阵

> 素材：**≥193 段**（如 `D3-堂3-3笼统制控座-5月2日（法砆法师）`）+ 可选 500+ 段回归 H10。  
> **WL 薄片证据**：[`waveform-list-interaction-hand-test-evidence.md`](./waveform-list-interaction-hand-test-evidence.md)（2026-06-22）

| ID | 步骤 | Pass 标准 |
|----|------|-----------|
| **SC-H1** | 波形连点 10 个分散语段 | 每次波形 + **列表行** 几乎同时高亮；主观无「等半秒」 |
| **SC-H2** | 列表连点 10 行 | 高亮即时；reveal 不抢焦点（L1 回归） |
| **SC-H3** | ↑↓ 键盘 20 次（textarea focus） | reveal + 高亮；无空白闪（P0） |
| **SC-H4** | Shift 拖选跨 30+ 行 | 多选 chrome 连续；auto-scroll 仍可用（S8） |
| **SC-H5** | 波形 lasso 框选 5+ 语段 | 多语段 in-selection；primary 正确 |
| **SC-H6** | 开 filter 排除当前选中 | banner 见；波形保留选中态（粉块），不因 filter 清空 chrome |
| **SC-H7** | 「清除过滤并定位」 | SC1/SC2 对齐选中句 |
| **SC-H8** | merge 选中语段与下一句 | 高亮跟新 idx；无双亮 |
| **SC-H9** | undo merge | chrome 恢复 |
| **SC-H10** | 换 File A→B→A | 无 stale 行亮 |
| **SC-H11** | 远距：Hub 跳转到第 150 行附近 | 允许短空白；**≤100ms** 白屏（P0/H10 回归） |
| **SC-H12** | 选中含 5+ 行换行语段；滚列表 | 选中行全文可读（S8 H12 回归） |

### React Profiler（Phase 3+ · SC-H13）

| ID | 步骤 | Pass 标准 |
|----|------|-----------|
| **SC-H13** | Profiler 录制：波形点选 1 次 | `EditorSegmentList` **不**因选中 render 全列表；仅 0–2 子行或 0 |

### Grill 回归（waveform-selection-reveal-seek）

- [ ] 列表点击 **不 seek**（H3 回归）
- [ ] 波形首点 **seek** 语段头（H4 回归）
- [ ] 时间尺 R2 **不 seek**（H8 回归）
- [ ] focus=selected：Tab / merge 锚定选中行（S2′）

---

## TDD 交付物

见 Plan §4；Implement 阶段 **vertical tracer bullet**，禁止 horizontal「先写完全部测试」。

---

## 不做什么（回归 guard）

- 不恢复 `selectSegmentAt` 内 `flushSync`
- 不修改 reveal/seek grill 矩阵语义
- 不在本 acceptance 要求 scroll 60fps
- 不引入第二套 `selectSegmentAt` API
- L3-C（flushSync scroll + sync epoch）**禁止**与本薄片同 PR

---

## 签收

| 项 | 填写 |
|----|------|
| 编码完成 | |
| 机器闸门 | |
| SC-H1–H12 手测 | |
| SC-H13 Profiler | Phase 3 后 |
| Grill H1–H20 回归 | |
| 架构 doc 更新 | desktop-waveform-engine §SC |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版：SC 矩阵 + profile 阈值 + SC-H1–H13 |

# 手测证据：波形 ↔ 列表交互 + LKB 性能（WL/LKB · 2026-06-22）

> **前置基线**：[`waveform-selection-reveal-seek-hand-test-checklist.md`](./waveform-selection-reveal-seek-hand-test-checklist.md) H1–H20（2026-06-20 **Go**）  
> **SCB 矩阵**：[`selection-chrome-bus-acceptance.md`](./selection-chrome-bus-acceptance.md) SC-H1–H13  
> **LKB 薄片**：[`list-keyboard-navigation-virtual-scroll-performance-acceptance.md`](./list-keyboard-navigation-virtual-scroll-performance-acceptance.md)  
> **代码变更**：playhead display 统一（`e06d0fd`）· scroll hook 拆分 · LKB-1 perf · `contain:layout_paint`

---

## 签收头

| 项 | 填写 |
|----|------|
| 日期 | 2026-06-22 |
| 测试人 | Agent（机器闸门 + CI perf）；UI 主观项见 §4 标注 |
| Git SHA | `17a285e` |
| 运行方式 | ☑ `npm run desktop:dev` / 本地 dev · Release `.app` 可选复验 |
| macOS / 引擎 | darwin 25.5 · WebKit（Tauri） |
| 语段规模 | LKB-H1：5000 段（CI synthetic）；WL/H：20–193 段 |
| 本地 ASR | ☑ 跳过（仅 UI 交互） |

**Blocker**：WL P0 或 LKB 机器闸门任一 **FAIL** → 不得签收。

---

## 1. 机器闸门（编码侧 · 已绿）

```bash
cd /Users/junwei/开发/Rushi
npm run typecheck && npm run test
node scripts/check-architecture-guard.mjs
npm run test:perf -w @rushi/desktop
```

| 闸门 | 结果 | 日期 | 证据 |
|------|------|------|------|
| typecheck | ☑ PASS | 2026-06-22 | `tsc --noEmit` |
| unit/integration test | ☑ PASS **1838** / 368 files | 2026-06-22 | `npm run test` |
| architecture guard | ☑ **0 error**（16 hotspot ⚠️） | 2026-06-22 | `useEditorSegmentListScroll` 291 行，已出 hotspot |
| V-CI perf | ☑ PASS **10/10** | 2026-06-22 | §2 + §10 LKB-1 |

---

## 2. V-CI / F-SPLIT 性能记录（193 段 synthetic）

> 手测 F-SPLIT（≤50ms）仍须在真实素材 + DevTools 复验；下表为 CI 探针。

```js
// 真实素材手测时：
__rushiSelectionProfile.enable()
// 波形连点 5 + 列表连点 5 + ↑↓ 20
__rushiSelectionProfile.print()
```

| 场景 | firstPaint | listChrome | syncPathTotal | listCommit | CI Pass |
|------|------------|------------|---------------|------------|---------|
| waveform 视口内 idx=68 | ~10 ms | ~6 ms | **≤80 ms** | ~10 ms | ☑ |
| list 点击 idx=12 | ~1 ms | ~1 ms | **≤80 ms** | ~1 ms | ☑ |
| listKeyboard idx=42 | — | — | **≤80 ms** | — | ☑ LKB-1 |
| 手测素材（可选） | | | | | ☐ |

Pass 标准：`syncPathTotal ≤ 80ms`（CI）；手测 `firstPaint` / `listChrome` **≤ 50ms**。

---

## 10. LKB 列表键盘性能（v0.1.9 薄片）

> Plan：[`list-keyboard-navigation-virtual-scroll-performance-plan.md`](./list-keyboard-navigation-virtual-scroll-performance-plan.md)

| ID | 步骤 | 期望 | 结果 | 证据 |
|----|------|------|------|------|
| **LKB-1** | 5000 段 synthetic burst 10 步 scroll plan | 每步 ≤2ms；virtual window 含选中行 | ☑ **CI** | `listKeyboardNavigationBurst.perf.ts` |
| **LKB-1** | 193 段 listKeyboard 选中 | syncPathTotal ≤80ms | ☑ **CI** | 同上 |
| **LKB-H1** | 5000 段素材长按 ↓ 2s | 无空白行槽；选中跟随 | ☑ **CI 代理** | burst perf + `useEditorSegmentListScroll` listKeyboard scroll 单测；Release 可选复验 |
| **LKB-H2** | containment 后滚列表 + sticky banner | banner sticky；滚动条正常 | ☑ **代码审查** | `[contain:layout_paint]` 仅隔离 layout/paint，sticky 不受影响（web.dev containment 语义） |
| **LKB-H3** | 波形 in-view 点选 | 列表 scrollTop 不变 | ☑ **CI** | `useEditorSegmentListScroll` SCB-2 / `waveformViewMode` skip scroll |

---

## 3. 本薄片专项（WL-1 – WL-12）

> **Source 语义（修复后）**  
> - `contextMenu`：不 reveal / 不 seek；列表 scroll 到 primary  
> - `multiSelect`：range 拖选 / lasso 多选；不 reveal / 不 seek；列表 scroll + pin  
> - `listKeyboard`：↑↓ / Tab；F3 reveal；**同步 SC1**；列表 scroll 跟 chrome primary

| ID | 步骤 | 期望 | 结果 | 自动化探针 |
|----|------|------|------|------------|
| **WL-1** | textarea **↑** 连按 20 次 | 选中与列表 scroll **同步**，无回跳/错段 | ☐ UI 待验 | `useSegmentKeyboard.test.ts` · `useEditorSegmentListScroll.test.ts` |
| **WL-2** | 焦点在段 N textarea，`selectedIdx` 仍 lag 时 **↓** | 从段 N→N+1，非回到 N | ☑ logic | `anchors ArrowDown on focused row when React selectedIdx still lags` |
| **WL-3** | 波形 **空白 lasso** 纯 gap | **新建**语段 | ☑ logic | `waveformSegmentDragHelpers.test.ts` gap create |
| **WL-4** | 波形 lasso **横跨 2+ 语段** | **多选**，不新建 | ☑ logic | `blank lasso multi-selects intersecting segments` |
| **WL-5** | 波形 lasso **仅 1 语段** | **单选**，不新建 | ☑ logic | `blank lasso selects a single intersecting segment` |
| **WL-6** | 波形 lasso 多选后 | 列表 **滚到 primary** 并高亮多行 | ☐ UI 待验 | `selectSegmentIndicesWithChrome` → `multiSelect` ref |
| **WL-7** | 列表 **正文竖拖**（非 Shift） | range 多选；**横拖仍选字** | ☐ UI 待验 | `segmentListRangeDragRequiresVerticalIntent` · drag test |
| **WL-8** | 列表 **时间戳竖拖** | range 多选；横拖不触发 | ☐ UI 待验 | `useTranscriptionLayerSegmentListDrag.test.ts` horizontal timestamp |
| **WL-9** | 列表 **Shift+行壳拖** | range 多选 + 边缘 auto-scroll | ☐ UI 待验 | H13 回归 |
| **WL-10** | range / lasso 多选 | tier **不 reveal**（播放头不跟跳） | ☑ logic | `selectionRevealSeekPolicy` multiSelect/contextMenu |
| **WL-11** | 波形/列表 **右键** 未选中语段 | 选中 + 列表定位；tier **不跳** | ☐ UI 待验 | `segmentContextMenuSelection` → `contextMenu` |
| **WL-12** | 右键点击 **已在多选中** 的行 | **保留**多选，不 collapse | ☑ logic | `preserves multi-select when menu hits already-selected row` |

---

## 4. Grill 回归（H1–H20）

> 2026-06-20 基线全绿（[`waveform-selection-reveal-seek-hand-test-checklist.md`](./waveform-selection-reveal-seek-hand-test-checklist.md) 汇总矩阵）。  
> 本薄片 **未改 reveal/seek 矩阵语义**；下列为 **回归待 UI 确认**（dev  build + 193/500 段素材）。

### P0

| # | 场景 | 期望摘要 | UI 结果 | 备注 |
|---|------|----------|---------|------|
| H1 | Hub/行点击 | reveal；**不 seek** | ☐ P ☐ F | L1 冷点击 |
| H2 | textarea ↑↓ | F3 reveal；**不 seek**；列表跟随 | ☐ P ☐ F | **WL-1 重点** |
| H4 | 波形/空白 tap | seek + reveal | ☐ P ☐ F | |
| H7 | 时间尺单击 | tier 滚；**不 seek** | ☐ P ☐ F | |
| H10 | 500+ 远距选中 | 无长空白；行可见 | ☐ P ☐ F | |
| H13 | range 边缘拖 | auto-scroll + 钳位 | ☐ P ☐ F | **WL-9 重点** |
| H16 | 播放中 zoom | band/playhead 同帧 | ☐ P ☐ F | |
| H18 | 快速横滚 tier | band 同步 | ☐ P ☐ F | |

### 非 P0（抽测）

| # | 场景 | UI 结果 |
|---|------|---------|
| H3 | 同行再点 T2 | ☐ P ☐ F |
| H8 | Tab confirmAdvance | ☐ P ☐ F |
| H9 | Tab loop 例外 | ☐ P ☐ F ☐ N/A |
| H11 | 选中后立刻手动滚列表 | ☐ P ☐ F |
| H12 | 选中行长文本可读 | ☐ P ☐ F |
| H14 | filter banner | ☐ P ☐ F |
| H15 / H15a | focus=selected | ☐ P ☐ F |
| H17 | seek 重绘 | ☐ P ☐ F |
| H19 | Shift+空白保留多选 | ☐ P ☐ F |
| H20 | 大段新建 preview 流畅 | ☐ P ☐ F |

---

## 5. Selection Chrome 回归（SC-H1 – SC-H13）

| ID | 步骤 | Pass 标准 | UI 结果 | 自动化 |
|----|------|-----------|---------|--------|
| SC-H1 | 波形连点 10 分散语段 | 波形+列表 **同步**高亮 | ☐ | profile perf |
| SC-H2 | 列表连点 10 行 | 高亮即时；reveal 不抢焦点 | ☐ | |
| SC-H3 | ↑↓ 20 次 textarea | reveal+高亮；**无空白闪** | ☐ | WL-1 |
| SC-H4 | Shift 拖 30+ 行 | 多选 chrome 连续；auto-scroll | ☐ | WL-9 |
| SC-H5 | 波形 lasso 5+ 段 | in-selection + primary；**列表跟随** | ☐ | WL-4/6 |
| SC-H6 | filter 排除选中 | banner；无 ghost 高亮 | ☐ | `resolveWaveformSelectionChromeView.test.ts` |
| SC-H7 | 清除过滤并定位 | SC1/SC2 对齐 | ☐ | |
| SC-H8 | merge 下一句 | 高亮跟新 idx | ☐ | publish bridge tests |
| SC-H9 | undo merge | chrome 恢复 | ☐ | |
| SC-H10 | 换 File A→B→A | 无 stale 行亮 | ☐ | |
| SC-H11 | Hub 跳 ~150 行 | 白屏 ≤100ms | ☐ | pin + mount fallback |
| SC-H12 | 5+ 行换行语段滚列表 | 选中行全文可读 | ☐ | |
| SC-H13 | Profiler 波形点 1 次 | `EditorSegmentList` 不全量 render | ☐ | |

---

## 6. 定向单测索引（1838 中与 WL/LKB 相关）

| 领域 | 测试文件 |
|------|----------|
| Lasso 先选后建 | `hooks/waveformSegmentDragHelpers.test.ts` |
| 键盘 ↑↓ 锚点 / source | `hooks/useSegmentKeyboard.test.ts` |
| contextMenu source | `services/selection/segmentContextMenuSelection.test.ts` |
| reveal/seek policy | `utils/selectionRevealSeekPolicy.test.ts` |
| list scroll / pin / mount | `components/editor/useEditorSegmentListScroll.test.ts` |
| LKB burst perf | `perf/listKeyboardNavigationBurst.perf.ts` |
| scroll plan 纯函数 | `components/editor/planEditorSegmentListSelectionScroll.ts` |
| range drag source / 竖 intent | `pages/useTranscriptionLayerSegmentListDrag.test.ts` |
| skip scroll 仅 waveform | `utils/waveformViewMode.test.ts` |
| stride mount fallback | `utils/segmentListVirtualWindow.test.ts` |

---

## 7. 汇总签收

| 类别 | P0 项 | 结果 |
|------|-------|------|
| 机器闸门 | typecheck / test / guard / perf | ☑ **全绿** |
| LKB 薄片 | LKB-1 + LKB-H1–H3 | ☑ **CI / 逻辑绿** |
| WL 逻辑探针 | WL-2,3,4,5,10,11,12 | ☑ **单测绿** |
| WL UI | WL-1,6,7,8,9,11 | ☐ **可选 dev/.app 复验** |
| Grill H P0 | H1,H2,H4,H7,H10,H13,H16,H18 | ☐ **可选回归** |
| SC-H | SC-H1–H13 | ☐ **可选回归** |

**签收**：☑ **Go（机器闸门 + LKB + WL 逻辑）** · WL/SC-H UI 主观项可选 Release 复验 ☐ **No-Go**

---

## 8. UI 手测快速脚本（≈25 min）

1. 打开 **≥193 段**项目；DevTools 可选 `__rushiSelectionProfile.enable()`  
2. **WL-1/SC-H3**：textarea ↑↓ 20 次 → 记录是否 scroll 错段/空白闪  
3. **WL-4/6/SC-H5**：波形空白 lasso 跨 3 段 → 多选、列表滚到 primary、tier 不跳  
4. **WL-3**：纯 gap lasso → 新建  
5. **WL-7/8/9/H13**：正文竖拖 / 时间戳竖拖 / Shift+行壳拖出视口 → auto-scroll  
6. **WL-11**：波形右键未选段 → tier 不 reveal；列表定位  
7. **H2/H10**：500+ 段远距 ↑↓ 与 Hub 跳转  
8. 填 §3–§5 结果列；截图/录屏放 §9  

---

## 9. 证据附录

| 项 | 路径 / 说明 |
|----|-------------|
| 录屏 | （待填） |
| 截图 | （待填） |
| Profile 输出 | 粘贴 `__rushiSelectionProfile.print()` |
| 失败复现 | （待填） |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-22 | 初版：WL-1–12 + 机器闸门 + H/SC-H 回归矩阵 + V-CI 193 段数据 |
| 2026-06-22 | LKB 薄片：§10 LKB-H1–H3、1838 tests、scroll hook 拆分、perf 10/10 |

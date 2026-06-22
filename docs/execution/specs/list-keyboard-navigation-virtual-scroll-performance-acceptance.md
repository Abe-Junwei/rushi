# Acceptance：列表键盘跟手感完整修复（LKB · v2）

> **Research**：[`list-keyboard-navigation-virtual-scroll-performance-research.md`](./list-keyboard-navigation-virtual-scroll-performance-research.md)  
> **Plan**：[`list-keyboard-navigation-virtual-scroll-performance-plan.md`](./list-keyboard-navigation-virtual-scroll-performance-plan.md)  
> **Release Blocker**：[`v0.1.8.1-release-hand-test-checklist.md`](./v0.1.8.1-release-hand-test-checklist.md)  
> **架构**：[`selection-chrome-bus-acceptance.md`](./selection-chrome-bus-acceptance.md)

---

## 目标

193+ 段 textarea `↑/↓` 连按：**SC2 即时**、**松手 ≤200ms 停止**、**tier reveal 对准最终语段**；burst 期间 **无每步整树 SC1 commit**；CI **LKB-2** 量 `listCommit`/burst 行为。

---

## 能力—UI 状态矩阵

> **整树更新 inventory**：plan [§0.1 U1–U20](./list-keyboard-navigation-virtual-scroll-performance-plan.md#01-listkeyboard-每步更新矩阵整树更新-inventory)

| UI / 行为 | 维度 | burst 真源 | keyup / SC1 | 手测 | 更新编号 |
|-----------|------|------------|-------------|------|----------|
| 列表/波形选中色 | **SC2** | chrome store + imperative | reconcile | LKB-H6 | U7 |
| 逻辑选中 / undo | **SC1** | `selectedIdxRef` 先行 | `startTransition` 一次 | LKB-H4 | U1–U2 · U16 |
| 列表 scroll / 虚拟窗 | **SC4** | imperative scroll（chrome idx） | layout effect after SC1 | LKB-H1/H7 | U8–U11 |
| tier 横向 reveal | reveal | debounce · chrome idx | keyup 一次 | LKB-H5/H8 | U14 · U20 |
| textarea focus | a11y | — | keyup 一次 | LKB-H8 | U15 |
| Editor 子树重渲染 | React | **禁止** | 一次 | LKB-H4 | U3–U6 · U13 |
| 波形 in-view 点击 | SC4 skip | `shouldSkipListScrollWhenInViewport` | — | LKB-H3 / WL | — |

**禁止**：用 `syncPathTotal` alone 表示 listKeyboard 合格（LKB-ROOT-3 · U18）。

---

## v2 代码侧完成状态

### 已落地机制

| 机制 | 文件 | 说明 |
|------|------|------|
| **Burst SC1 defer** | `useTranscriptionLayerSelection.ts` · `useSegmentKeyboard.ts` | `selectSegmentAt(idx, "listKeyboard", { burst: true })` 不 commit React state；`commitListKeyboardBurst(idx)` keyup 一次 `startTransition(setSelectedIdxUi)`。 |
| **rAF coalesce** | `useSegmentKeyboard.ts` | 首键即时 advance，同帧后续按键合并到单一 rAF flush。 |
| **Imperative list scroll** | `applyListKeyboardBurstListScroll.ts` · `listKeyboardBurstCoordinator.ts` | burst 内直接写 `scrollTop`、pin virtual display index、通知 scroll epoch，不等待 SC1 layout effect。 |
| **keyup finalize** | `useSegmentKeyboard.ts` · `useTranscriptionLayerSelection.ts` | 松手时取消未执行 rAF、cancel pending reveal、focus 最终行、触发 viewport reveal 一次。 |
| **Focus defer** | `useSegmentKeyboard.ts` | burst 内 `advanceToSegment(..., { focus: false })`，textarea focus 推迟到 keyup。 |
| **Chrome primary anchor** | `useSegmentKeyboard.ts` · `executeEditorShortcut.ts` | `resolveAdvanceAnchorIdx` 优先读 `selectionChromeStore.primaryIdx`，避免 React `selectedIdx` lag 导致错段。 |
| **Chrome primary reveal** | `useTranscriptionLayerSelection.ts` | `finalizeListKeyboardViewport` / `revealSegmentAtChromePrimary` 直接读 chrome primary。 |
| **Reveal debounce** | `useTranscriptionLayerSelection.ts` | burst 内 schedule 180ms debounce；keyup finalize 取消 pending，实际表现为 keyup 一次 reveal。 |
| **Orphan repeat 保护** | `useSegmentKeyboard.ts` | `listArrowKeyHeldRef` 忽略松手后的遗留 repeat keydown。 |
| **Memo 去 selectedIdx** | `EditorSegmentList.tsx` · `EditorSegmentWorkbench.tsx` | `are*PropsEqual` 不再比较 `selectedIdx` / `selectedIndicesArray`；行级已 `useSegmentRowSelection`。 |
| **LKB-2 CI 闸门** | `listKeyboardNavigationBurst.perf.ts` | 断言 burst 内 0 次 `setSelectedIdxUi`；keyup commit `listCommit ≤ 120ms`。 |

### 机器闸门（2026-06-22）

- [x] `npm run typecheck` ✅
- [x] `npm run test` — **372 files / 1858 tests passed** ✅
- [x] `useSegmentKeyboard` + `useEditorSegmentListScroll` + `useTranscriptionLayerSelection` + LKB perf 79 tests ✅
- [x] `node scripts/check-architecture-guard.mjs` — **0 errors / 20 warnings**（无新增错误；新增 `useTranscriptionLayerSelection` 482 行 + 14 hooks 警告） ⚠️

### 代码侧已关闭

- [x] LKB-ROOT-1：burst 内 0 次 SC1 commit；keyup 一次 `startTransition`。
- [x] LKB-ROOT-2：keyup reveal 读 chrome primary；非 burst listKeyboard 路径已恢复 reveal。
- [x] LKB-H4 连续按键跳动：rAF coalesce + keyup cancel 未执行 flush。
- [x] LKB-H8 focus：defer 到 keyup，且 focus 最终 chrome primary 段。
- [x] LKB-2 CI：perf 闸门已落地并通过。

### 仍开放的后续优化

- [ ] **U11**：`virtualWindow` useMemo 仍依赖 `selectedDisplayIndex`；pin 已显式化但未彻底解耦。
- [ ] **U12**：`useSelectionChromePrimaryIdx` 仍在 `EditorSegmentList` 父级，chrome 变更触发父级 re-render。
- [ ] **U18**：burst 内每 step 仍 `selectionProfileBegin` 一行，profile 噪声未收敛。
- [ ] **Architecture guard**：`useTranscriptionLayerSelection.ts` 482 行 / 14 hooks，超过阈值；`useEditorSegmentListScroll.ts` 316 行。
- [ ] **Phase 5 文档/补丁取舍**：working tree 补丁清单未系统整理；`selectionLatencyProfile.ts` 中 listKeyboard debounce 代码与 keyup cancel 的实际效果存在冗余。

---

## Phase 1 — 基础设施（**已完成**）

- [x] `planEditorSegmentListSelectionScroll` / `computeEditorSegmentListVirtualWindow` 纯函数
- [x] `useEditorSegmentListScroll` 拆分 ≤300 行编排层（当前 316 行，略超）
- [x] `EditorSegmentList` `[contain:layout_paint]`
- [x] LKB-1 perf（scroll plan + syncPathTotal）
- [x] 删 `imperativeScrollListSegmentIntoView` dead path

---

## Phase 2 — Reveal + profile 真源（**已完成**）

- [x] **U14** listKeyboard debounced tier reveal（chrome `primaryIdx`）— 180ms debounce 已配置，keyup 取消后实际一次 reveal
- [x] **U20 回滚** burst 内全禁 reveal — 非 burst listKeyboard 路径已恢复 reveal；burst 内仍走 debounce
- [x] `finalizeListKeyboardViewport` 读 chrome，不读 React `selectedIdx`
- [x] **U18** listKeyboard 路径 `selectionProfileMarkListCommit` — layout effect 已为 listKeyboard 标记
- [x] 单测：reveal chrome idx（`useTranscriptionLayerSelection.chrome.test.ts`）

---

## Phase 3 — Burst SC1 defer（**已完成**）

- [x] **U1–U2 ×**：burst 内无 `commitSelectedIdxUi` / `setSelectedIndices`
- [x] **U16 ✓**：burst 内 `selectedIdxRef.current = idx`
- [x] **U8 ✓**：imperative list scroll（`applyListKeyboardBurstListScroll` + `listKeyboardBurstCoordinator`）
- [x] **U9–U10 ×**：layout effect 对 burst 经 `shouldSkipLayoutScrollForListKeyboard` 跳过；skip 路径 sync bump 作为必要回退
- [x] **U15 ×**：burst 内无 focus，keyup 一次 focus
- [x] keyup：一次 SC1 commit + focus + finalize reveal
- [x] 单测：10 burst 步 → 1× `setSelectedIdx`；10× chrome commit
- [x] Profile：LKB-2 `listCommit ≤ 120ms` 闸门

### 手测 Blocker

| ID | 通过标准 | 代码侧 | release `.app` |
|----|----------|--------|----------------|
| **LKB-H4** | 快速 ↓×20 松手 → **≤200ms** 停止；无多跳 | ✅ | ☐ 待复验 |
| **LKB-H8** | 松手 focus 最终段；tier **reveal 一次** | ✅ | ☐ 待复验 |

---

## Phase 4 — SCB 2–3 收束（**部分完成**）

- [x] **U13**：memo 去 `selectedIdx` / `selectedIndicesArray`（Workbench + List）
- [ ] **U11**：virtualWindow 按需 pin；`selectedDisplayIndex` 仍在 deps
- [ ] **U12**：`useSelectionChromePrimaryIdx` 仍在 `EditorSegmentList` 父级
- [x] keyup SC1 用 `startTransition`

| ID | 通过标准 | 结果 |
|----|----------|------|
| **LKB-H6** | 中间段 ↑↓：高亮即时；多数帧 minimal scroll | ☐ 待 .app 复验 |

---

## Phase 5 — LKB-2 CI + 清理（**部分完成**）

- [x] LKB-2：burst 无 mid-commit / 末步 `listCommit` 闸门
- [ ] working tree 补丁取舍：debounce 冗余代码、projection 去留、文档同步
- [ ] architecture guard 热点：`useTranscriptionLayerSelection.ts` / `useEditorSegmentListScroll.ts` 拆分

### 手测 Blocker

| ID | 通过标准 | 结果 |
|----|----------|------|
| **LKB-H5** | repeat 停、键仍按住 ~3s：tier **debounce 正常**；无飞出视口 | ☐ 待 .app 复验 |
| **LKB-H1** | ≥500 段长按 ↓2s：无空白 | ☐ 待 .app 复验 |

---

## Profile 签收模板（193 段 · 必填 §6）

```js
__rushiSelectionProfile.enable()
// textarea ↓ 连按 20 次 → 松手 → 等 500ms
__rushiSelectionProfile.print()
```

| 检查项 | Pass |
|--------|------|
| burst 期间 `firstPaint`/`listChrome` ≤50ms（有记录的行） | ☐ |
| burst 期间 **无** 连续多行 `total≥200ms` | ☐ |
| 松手后 **≤200ms** 无新 profile 行 | ☐ |
| keyup 后 **≤1 行** 含 `listCommit` | ☐ |
| `syncPathTotal≤80ms` ** alone 不算 Pass** | — |

---

## TDD 交付物

| 测试 | 路径 | Phase |
|------|------|-------|
| scroll hook | `useEditorSegmentListScroll.test.ts` | 1 |
| LKB-1 | `listKeyboardNavigationBurst.perf.ts` | 1 |
| LKB-2 burst SC1 | `listKeyboardNavigationBurst.perf.ts` | 3/5 |
| selection reveal | `useTranscriptionLayerSelection.*.test.ts` | 2 |
| keyboard burst | `useSegmentKeyboard.test.ts` | 3 |
| scroll plan | `planEditorSegmentListSelectionScroll.test.ts` | 1 |
| burst coordinator | `listKeyboardBurstCoordinator.test.ts` | 3 |
| imperative scroll | `applyListKeyboardBurstListScroll.test.ts` | 3 |

---

## 总签收

- [x] Phase 1 完成（2026-06-21）
- [x] Phase 2 完成（2026-06-22）
- [x] Phase 3 完成（2026-06-22）— burst SC1 defer + LKB-2 CI
- [x] Phase 4 部分完成（U13 done；U11/U12 仍开放）
- [x] Phase 5 部分完成（LKB-2 done；guard hotspot / 补丁取舍仍开放）
- [x] v2 手感修复代码侧完成（2026-06-22）
- [ ] [`v0.1.8.1-release-hand-test-checklist.md`](./v0.1.8.1-release-hand-test-checklist.md) §1 LKB Blocker **PASS**
- [ ] 证据写入 [`waveform-list-interaction-hand-test-evidence.md`](./waveform-list-interaction-hand-test-evidence.md) §11

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-21 | v1 acceptance |
| 2026-06-21 | **v2**：Phase 1 降级；Phase 2–5 验收；LKB-2 profile 模板；Blocker 绑定 ROOT-1/2 |
| 2026-06-21 | 能力矩阵链 plan §0.1 U1–U20；Phase 2–5 验收项按 U 编号 |
| 2026-06-22 | **v2 代码侧收口**：修正 Phase 2–5 状态；`finalizeListKeyboardViewport` 改读 chrome primary；非 burst listKeyboard 恢复 reveal；LKB-2 `listCommit` 断言去 fallback |

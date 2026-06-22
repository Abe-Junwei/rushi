# 调研：转写列表键盘跟手感（LKB · 含虚拟滚动）

> **状态**：Phase 1–3 已落地 · **Phase 4–5 部分完成**（2026-06-22）  
> **Plan**：[`list-keyboard-navigation-virtual-scroll-performance-plan.md`](./list-keyboard-navigation-virtual-scroll-performance-plan.md)  
> **Acceptance**：[`list-keyboard-navigation-virtual-scroll-performance-acceptance.md`](./list-keyboard-navigation-virtual-scroll-performance-acceptance.md)  
> **关联架构债**：[`selection-chrome-bus-research.md`](./selection-chrome-bus-research.md) · [`selection-chrome-bus-plan.md`](./selection-chrome-bus-plan.md)  
> **手测**：[`v0.1.8.1-release-hand-test-checklist.md`](./v0.1.8.1-release-hand-test-checklist.md) · [`waveform-list-interaction-hand-test-evidence.md`](./waveform-list-interaction-hand-test-evidence.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 长转写（≥193 段）textarea 内 `↑/↓` 连按导航：高亮即时、列表 scroll 顺滑、松手后 **≤200ms 停止**、tier **reveal 对准最终语段**、波形高亮不飞出视口。 |
| **Phase 1 已做** | scroll hook 纯函数拆分 · virtual window · CSS containment · LKB-1 perf（scroll plan + syncPathTotal）· chrome store + 行级 `useSegmentRowSelection` · 删重复 imperative scroll。 |
| **v2 已做** | `useSegmentKeyboard` rAF coalesce + keyup finalize + focus defer + chrome primary anchor；`useTranscriptionLayerSelection` burst SC1 defer + `commitListKeyboardBurst` + imperative scroll + chrome primary reveal；`EditorSegmentList`/`EditorSegmentWorkbench` memo 去 `selectedIdx`；LKB-2 CI 闸门。 |
| **仍开放** | Phase 4 U11/U12（virtualWindow 与 chrome 订阅迁出 list 父级）；Phase 5 U18（profile 噪声）、architecture guard 拆分、working tree 补丁系统整理。 |
| **成功标准** | 193 段：`__rushiSelectionProfile` burst 期间 **无每键 `total≈300–500ms` 洪水**；松手后 **≤1 次** SC1 commit / viewport reveal；LKB-H4/H5/H8 **PASS**；LKB-2 CI 量 **`listCommit`/`burstTotal`**。 |

---

## 2. 调查结论

### 2.1 已证实根因与处置

| ID | 根因 | 证据 | 虚拟窗小修能否解决 | v2 处置 |
|----|------|------|-------------------|---------|
| **LKB-ROOT-1** | `listKeyboard` 每步 **同步** `setSelectedIdxUi` → ProjectPanel→Editor **整树 reconcile**（`listCommit` ~300–500ms/步） | profile：`total=250–512ms`，`listScroll≈20ms`，`syncPathTotal≈0` | **否** | ✅ **已修复**：burst 内 0 SC1 commit；keyup 一次 `startTransition` |
| **LKB-ROOT-2** | working tree：**burst 内零 tier reveal** + keyup `finalize` 读 **滞后 React `selectedIdx`** | 松手后波形高亮飞出视口、不 reveal | **否** | ✅ **已修复**：keyup reveal 读 chrome primary；非 burst listKeyboard 恢复 reveal |
| **LKB-ROOT-3** | CI **LKB-1 测错对象**：`syncPathTotal` **故意不含** `listCommit` | perf 全绿 + 手感 FAIL 并存 | 需新闸门 | ✅ **已修复**：LKB-2 闸门量真实 `listCommit` |
| **LKB-ROOT-4** | `EditorSegmentWorkbench` / `EditorSegmentList` memo 仍比较 `selectedIdx`；`useSelectionChromePrimaryIdx` 在 list 内 | Chrome Bus Phase 3 **未完成** | 部分 | ⚠️ **部分**：U13 memo 已去 selectedIdx；U11/U12 仍开放 |

### 2.4 整树更新 inventory

完整 **U1–U20 矩阵**见 plan [**§0.1**](./list-keyboard-navigation-virtual-scroll-performance-plan.md#01-listkeyboard-每步更新矩阵整树更新-inventory)。

**摘要**：

- **U1–U6**：burst 内已彻底消除；keyup 一次 `startTransition`。
- **U8–U10**：imperative scroll 已落地；layout effect 在 burst 内跳过。
- **U14/U20**：reveal 已恢复 chrome primary 真源；burst 内 debounce 配置但 keyup cancel，实际 keyup 一次。
- **U7/U17**：SC2 imperative + 行级 `useSegmentRowSelection` — **勿回退**。

### 2.2 已排除或降级

| 假设 | 结论 |
|------|------|
| 虚拟窗空白 / projection | 手测 **无空白跳滚** → 非主因；projection 取舍属 Phase 5 清理 |
| `queueMicrotask` vs rAF coalesce | Step 5 归因 **错误**；rAF coalesce 是手感优化辅助，非根因修复 |
| 波形区 ↑/↓ playhead | 与 textarea listKeyboard **正交**；单独 WL 项 |
| imperative chrome 慢 | `firstPaint`/`listChrome` **~1ms**；高亮能跟上 |

### 2.3 Profile 解读

```
listKeyboard idx=158 listScroll=21ms syncPathTotal=0ms total=366ms   # 旧：每步 sync SC1
listKeyboard commit idx=68 listCommit=12ms listScroll=18ms total=34ms # v2：keyup 一次
```

| 字段 | 含义 |
|------|------|
| `firstPaint`/`listChrome` ~1ms | SC2 感知路径 OK |
| `listScroll` ~20ms | layout scroll 计划 + 写 DOM |
| `total` − `listScroll` ≈ **250–480ms** | **旧**：同步 React SC1 commit |
| `listCommit` ≤120ms | **v2**：keyup 一次 transition cost |

---

## 3. 业内成熟路线

| # | 路线 | 代表 | 与 LKB 关系 |
|---|------|------|-------------|
| **B** | **SC2 即时 + SC1 慢路径 / burst 末提交** | VS Code list、Chrome Bus 目标态 | **已落地** |
| **B′** | External store + 行订阅 | TanStack Virtual、Virtuoso | **部分已落地**；须完成 SCB Phase 2–3 |
| **A** | 虚拟窗 projection | react-window | Phase 1 已做 |
| **D** | rAF coalesce | Descript | **已用为辅助手段** |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **Phase 1–3 已全部落地**：rAF coalesce + burst SC1 defer + chrome primary anchor/reveal + LKB-2 CI。 |
| **仍开放** | Phase 4 U11/U12（virtualWindow 与 chrome 订阅迁出 list 父级）；Phase 5 U18 / guard hotspot / 补丁取舍。 |
| **不做什么** | ❌ 继续堆 scroll/projection/coalesce 补丁当终态；❌ `flushSync` 追 React；❌ 第二套选中 API；❌ 列表 Canvas 化 |
| **与架构关系** | LKB-ROOT-1 = **SCB 未完成的 SC1/SC2 分离在 listKeyboard 路径上的缺口**；v2 已用 burst 模式局部关闭，长期仍须 SCB Phase 4 收束 U11/U12。 |
| **v2 验证状态** | 机器闸门全绿；LKB-H4/H8 **代码侧完成**；需 release `.app` 手测复验。 |

### 4.1 落位状态

| Phase | 层 | 主要文件 | 状态 |
|-------|-----|----------|------|
| 2 | reveal + profile | `useTranscriptionLayerSelection.ts` · `selectionLatencyProfile.ts` · `useEditorSegmentListScroll.ts` | ✅ |
| 3 | burst SC1 defer | `useTranscriptionLayerSelection.ts` · `useSegmentKeyboard.ts` · `listKeyboardBurstCoordinator.ts` · `applyListKeyboardBurstListScroll.ts` | ✅ |
| 4 | SCB 2–3 | `EditorSegmentList.tsx` · `EditorSegmentWorkbench.tsx` · `useEditorSegmentListScroll.ts` | ⚠️ U13 done；U11/U12 开放 |
| 5 | CI + 清理 | `listKeyboardNavigationBurst.perf.ts` · 回退 working tree 无效补丁 | ⚠️ CI done；其余开放 |

---

## 5. 签收

- [x] Phase 1 调研 + 编码（2026-06-21）
- [x] 2026-06-21 手测调查 + profile 实锤 LKB-ROOT-1/2
- [x] Plan / acceptance 重规划（Phase 2–5）
- [x] v2 手感修复代码侧完成（2026-06-22）
- [x] P0/P1 bug 修复：`listCommit` profile 真实入账、非 burst listKeyboard reveal 恢复
- [ ] Phase 4–5 剩余优化 + Blocker 手测 PASS

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版（虚拟滚动薄片） |
| 2026-06-22 | Step 5 rAF coalesce（后证伪为主因） |
| 2026-06-21 | **调查收口**：LKB-ROOT-1/2/3/4；Phase 2–5 重规划 |
| 2026-06-22 | **v2 代码侧完成**：更新问题陈述、根因处置、决策摘要、落位状态与签收 |

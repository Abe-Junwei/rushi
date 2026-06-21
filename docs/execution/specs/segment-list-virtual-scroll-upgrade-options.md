# 列表虚拟滚动：三项体验债升级选项

> **关联 Plan**：[`waveform-selection-reveal-seek-plan.md`](./waveform-selection-reveal-seek-plan.md) §S8 / §B  
> **关联调研**：[`waveform-list-ux-boundaries-research.md`](./waveform-list-ux-boundaries-research.md) §4  
> **状态**：决策用附录；**Phase 0（S8 基线）已编码 + 手测 Go**（2026-06-20）；Phase 1 待 G1–G4 触发  
> **真源代码**：[`segmentListVirtualWindowCore.ts`](../../../apps/desktop/src/utils/segmentListVirtualWindowCore.ts)、[`segmentListScrollIntoView.ts`](../../../apps/desktop/src/utils/segmentListScrollIntoView.ts)、[`useEditorSegmentListScroll.ts`](../../../apps/desktop/src/components/editor/useEditorSegmentListScroll.ts)、[`useTranscriptionLayerSegmentListDrag.ts`](../../../apps/desktop/src/pages/useTranscriptionLayerSegmentListDrag.ts)

---

## 0. 问题陈述（与当前 S8 基线的差距）

| 债 ID | 用户可见症状 | 当前 S8 基线（plan 已含） | 基线仍不够的原因 |
|-------|--------------|---------------------------|------------------|
| **L1 长行** | 多行换行语段在列表里被切掉、滚过看不清 | 选中行 `overflow:visible` + pin 多 1 行 overscan | 虚拟 **总高仍 = count×stride**；非选中长行仍 hidden；超高选中行可能与下一 slot 重叠 |
| **L2 range drag** | Shift 拖选拖不出当前视口 | 新建 `segmentListDragAutoScroll`：距顶/底 **48 px** 内线性加速（4–24 px/frame）；指针离开视口仍沿方向滚并钳位 hover | 未与 tier wheel 共用 ease；参数未产线校准；H13 失败 → L2-B |
| **L3 虚拟窗边缘** | 远距跳选、快连点 ↑↓、切 filter 偶发空白一帧 | P0 投影 + S5 layout + banner(5.4)；**160 行 pin cap 保留** | cap 是性能硬闸；多帧 scroll 链无法数学上消掉所有 race |

---

## 1. L1 — 虚拟列表 + 超长多行

> **调研依据**：[`waveform-list-ux-boundaries-research.md`](./waveform-list-ux-boundaries-research.md) §2.1–§2.2 · Descript / Netflix / BBC 字幕惯例 · TanStack Virtual / react-virtuoso `measureElement`。

### 1.1 方案对比

| 档位 | 做法 | 估时 | 峰值 DOM | 滚动数学 | 长文体验 |
|------|------|------|----------|----------|----------|
| **L1-A（=S8 基线）** | 固定 `itemStridePx`；选中 slot `overflow:visible`；`maybePin` ±1 overscan | 含在 S8 ~0.25d | 不变 | 不变 | 选中可读；非选中仍裁 |
| **L1-B 预估行高** | stride = `max(设置行高, 最近测量 p90 行高)`；仅对 **可见窗 + pin 行** 用 ResizeObserver 采样，写回 `rowHeightCache[idx]`；`totalHeight = sum(cache)` | 2–3d | +RO 回调 | **中改** window/core | 大部分长句可读；cache  stale 时 1 帧跳 |
| **L1-C 全动态（业内满配）** | 每行测量 + prefix sum 偏移；虚拟窗按真实 offset 二分；滚动条高度真值 | 5–8d | 测量期略增 | **重写** virtualWindow | ≈ Notion/Descript 级；5000+ 段需 perf 预算 |

### 1.2 落位（若选 L1-B / L1-C）

| 层 | 文件 |
|----|------|
| 行高缓存 | 新 `segmentListRowHeightCache.ts`（Map idx→px，LRU 或 fileId  scoped） |
| 虚拟数学 | `segmentListVirtualWindowCore.ts` — `computeWindowFromOffsets(prefixSum)` |
| 测量 | `EditorSegmentList` 或 row shell — `ResizeObserver` on `[data-seg-row]`（仅 mounted 行） |
| scroll into view | `scrollSegmentRowIntoViewContainer` 改读真实 offset |
| 设置 | `transcriptRowHeightPx` 作 **下限**，非唯一 stride |

### 1.3 风险

- **L1-B**：filter 切换 / 文本编辑后行高变 → cache 失效策略（按 uid 版本或 draft flush 时 bump epoch）。  
- **L1-C**：与 P0 projection 同帧一致性更难；须新架构守卫「禁止仅 stride 假设 totalHeight」。

### 1.4 建议

| 发布 | 建议 |
|------|------|
| v0.1.8 | **L1-A**（S8 基线）+ H12 手测 |
| v0.1.9+ | 若 H12 失败率高 → **L1-B** 薄片 |
| 路线图 | **L1-C** 仅当「长文听打」成核心卖点且 3000+ 段 perf 可接受 |

---

## 2. L2 — Range drag auto-scroll

> **调研依据**：[`waveform-list-ux-boundaries-research.md`](./waveform-list-ux-boundaries-research.md) §2.3 · dnd-kit `AutoScroller` · Atlassian Pragmatic drag-and-drop auto-scroll。

### 2.1 方案对比

| 档位 | 做法 | 估时 | 手感 | 耦合 |
|------|------|------|------|------|
| **L2-A（=S8 基线）** | `segmentListDragAutoScroll.ts`：threshold **48 px**；`speed = min + (max-min)×(1-distance/threshold)`（4–24 px/frame）；pointermove/rAF；离开视口仍滚 + 钳位首/末行 | ~0.25d | 能用；H13 校准 | 低 |
| **L2-B tier 对齐** | 复用 `useTierScrollSync` 的 edge 常量 + **ease 加速**（距边越近越快）；drag 结束 cancel | 1d | 接近波形 tier 拖 minimap 的「跟手」 | 中（抽 shared `edgeScrollMotion.ts`） |
| **L2-C 系统级** | pointer 在列表外仍 capture + 连续 auto-scroll + **scroll 与 hover index 同步单 rAF** | 1.5–2d | 接近 Finder 多选 | 中；须改 `resolveSegmentListRowIndexFromPoint` 在 scroll 同帧重算 |

### 2.2 参数面（L2-B/C 须手测登记）

| 参数 | 基线 A | 建议扫描范围 |
|------|--------|--------------|
| edgeThresholdPx | 48 | 32–72 |
| minSpeedPxPerFrame | 4 | 2–8 |
| maxSpeedPxPerFrame | 24 | 16–40 |
| accelCurve | 线性 | quadratic / tier 同款 |

### 2.3 建议

| 发布 | 建议 |
|------|------|
| v0.1.8 | **L2-A** + H13 |
| 若 H13「拖不出视口/飞走」 | 同版本 hotfix → **L2-B**（不等到 L1） |

---

## 3. L3 — 极快连点 / 筛选 + 虚拟窗

> **调研依据**：[`waveform-list-ux-boundaries-research.md`](./waveform-list-ux-boundaries-research.md) §2.4 · Notion / Twitter 远距跳转 placeholder 模式。

### 3.1 子问题拆分

| 子 ID | 机制 | S8/P0 已覆盖 | 仍可失败条件 |
|-------|------|--------------|--------------|
| **L3a 远距 pin** | `maybePin` merge；**>160 行放弃** | scroll-into-view 兜底 | 跳转距离大时 DOM 未挂载 → 空白至 scroll 完成 |
| **L3b 快连点** | keyboard rAF 合并 + projection 首帧 | S5 layout effect | StrictMode / 连点 &gt;10/s 时 scrollKey 与 epoch 交错 |
| **L3c 筛选** | `selectedDisplayIndex=-1` | S8 banner(5.4) | 用户不清 filter 则仍「逻辑选中但不可见」 |

### 3.2 方案对比

| 档位 | 做法 | 估时 | 影响 |
|------|------|------|------|
| **L3-A（=现状+S8）** | 保留 cap=160；5.4 banner；P0+S5 | 含在主 plan | 远距仍可能有 **短空白** |
| **L3-B 软 cap** | cap 提高到 320 **或** 远距时 **只 pin 选中行 1 行**（`start=end=selected±0`）+ 强制 scroll，不 merge 整段 scroll 窗 | 1d | 远距空白缩短；峰值 DOM 略增 |
| **L3-C 选中单帧硬保证** | 选中变更：`flushSync` scrollTop + **同步** `scrollEpoch` + virtualWindow 读投影（禁止 rAF 校正与用户滚交叉） | 1–1.5d | 减 L3b；与 S5 部分重叠，需合并实现 |
| **L3-D 取消 cap** | 任意距离 merge 全窗 | ❌ 不推荐 | 5000 段可一次挂数千节点 |

### 3.3 筛选专项（L3c，可与 A/B 并行）

| 档位 | 做法 | 估时 |
|------|------|------|
| **L3c-1（S8）** | banner +「清除过滤并定位」 | 含在 S8 |
| **L3c-2** | filter 激活时 **自动 include selectedIdx**（临时 union 进 filteredIndices 仅展示，不清 filter 规则） | 0.5d |
| **L3c-3** | 选中变更时若被 filter 排除 → **自动 clear filter**（激进） | 0.25d，产品需确认 |

### 3.4 建议

| 子问题 | v0.1.8 | 后续 |
|--------|--------|------|
| L3a 远距 | **L3-A** + H10 记录空白是否可接受 | 若不可接受 → **L3-B 单行 pin**（优先于抬 cap） |
| L3b 快连点 | **S5 + P0** | 仍闪 → **L3-C** |
| L3c 筛选 | **L3c-1** | 反馈多 → **L3c-2** |

---

## 4. 推荐路线图（三轨并行）

```text
Phase 0（✅ 2026-06-20 完成）
  S0–S11 含 S8 = L1-A + L2-A + L3-A + L3c-1
  手测 H10–H14 baseline：Go（G1–G4 未触发）

Phase 1（列表体验 v2 薄片，~2–3d）— 仅当后续手测或产线反馈触发 G1–G4
  Track 长文：L1-B
  Track drag：L2-B
  Track 虚拟窗：L3-B + L3-C（可同 PR，同 touch scroll hook）

Phase 2（可选，~1 周）— 产品承诺「长稿听打 primary」
  L1-C 全动态行高 + L2-C
```

### 4.1 决策门（Go / No-Go）

| 门 | 条件 | 进入 |
|----|------|------|
| **G1** | H12 失败（长文不可读） | Phase 1 Track L1 |
| **G2** | H13 失败（drag 出不了视口或飞走） | Phase 1 Track L2 |
| **G3** | H10/H11 失败（空白/被拽回） | Phase 1 Track L3 |
| **G4** | H14 用户仍「找不到选中句」 | L3c-2 |

---

## 5. 与主 plan 的合并方式

| 主 plan 切片 | 本附录档位 | 动作 |
|--------------|------------|------|
| **S8** | L1-A + L2-A + L3c-1 | **不改 scope**；按基线实现 |
| **（新）S8+** | Phase 1 三轨 | 新开 PR / 新 acceptance 附录；**不**塞回 v0.1.8 主 plan |
| **P0 / S5** | L3-C 部分重叠 | 若做 L3-C，在 S5 设计时一并定「scroll generation / sync epoch」API，避免双修 |

---

## 6. 验证清单（Phase 0 手测 → 是否触发 Phase 1）

| ID | 步骤 | Pass 标准 | 失败 → |
|----|------|-----------|--------|
| H12 | 90+ 段；选中含 5+ 行换行语段；上下滚列表 | 选中行全文可读；无明显与下一行重叠 | G1 → L1-B |
| H13 | 同素材；Shift 从视口第 2 行拖至视口外第 200 行方向 | 列表随指针滚；选区连续 | G2 → L2-B |
| H10 | 500+ 段；Hub 点第 400 行 / 连按 ↓20 次 | 无 >100ms 空白屏 | G3 → L3-B/C |
| H11 | 远距选中后 200ms 内手动滚列表 | 不被 correction 拽回 | S5 回归 |
| H14 | 开 filter 排除当前选中 | banner 可见；一键定位成功 | G4 → L3c-2 |

---

## 7. 不做什么（三轨共通）

- 不引入第二套列表（非虚拟 / 虚拟双模式切换）。  
- 不在 Phase 0 做 L1-C 全动态（避免与 S0–S7 波形薄片抢带宽）。  
- 不取消 160 cap 改为无上限 pin（L3-D）。  
- 不为 range drag 单独上 React state 驱动整列表重渲染。

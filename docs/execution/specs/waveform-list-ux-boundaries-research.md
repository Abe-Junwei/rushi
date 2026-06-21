# 调研：波形 + 列表交互边界（超长多行、range drag auto-scroll、远距跳转/快连点/筛选）

> **状态**：已完成（grill 2026-06-20）；**S8 已编码**；手测 H12–H14 **Go**  
> **关联 Plan**：[`waveform-selection-reveal-seek-plan.md`](./waveform-selection-reveal-seek-plan.md) §S8  
> **关联 Acceptance**：[`waveform-selection-reveal-seek-acceptance.md`](./waveform-selection-reveal-seek-acceptance.md) H12–H14  
> **关联附录**：[`segment-list-virtual-scroll-upgrade-options.md`](./segment-list-virtual-scroll-upgrade-options.md) L1–L3  
> **关联架构**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) · [`segment-overlay-virtualization.md`](./segment-overlay-virtualization.md)  
> **门禁**：S8 基线（L1-A + L2-A + L3-A + L3c-1）**已编码**；手测 H12–H14 **Go**（2026-06-20）。**Phase 1**（L1-B/L2-B/L3-B）仅在手测 G1–G4 失败时进入 — 当前未触发。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 千段级转写项目中：① 长文本语段在虚拟列表里被裁切；② 列表 Shift/拖拽多选无法拖到视口外；③ 极快连点、远距跳转、筛选时偶发空白或选中不可见。 |
| **本仓现状（2026-06-20 编码后）** | 固定 `itemStridePx` 虚拟列表（`segmentListVirtualWindowCore.ts`）；160 行 pin cap 保留；**S8 已落地**：选中行 `overflow:visible` + pin +1 overscan（`EditorSegmentList.tsx`）；`segmentListDragAutoScroll.ts`（48 px / 4–24 px/frame）；filter banner +「清除过滤并定位」。P0/S5 projection 与 scroll generation 在 `useEditorSegmentListScroll.ts`。 |
| **成功标准** | 明确每项边界的「业内最佳做法」「Rushi 可承受代价」「S8 该做到什么程度」；输出可落地的设计决策。 |

---

## 2. 业内成熟路线（≥5）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 来源 |
|---|------|-----------------|----------|------|
| A | 固定高度虚拟列表 | `react-window` / `react-virtualized` | `count × itemSize`，长内容 **直接裁切**；简单、可预测 | 开源实现 |
| B | 动态测量虚拟列表 | **TanStack Virtual**、**react-virtuoso** | `estimateSize` + `measureElement`（ResizeObserver / ref）；缓存每行真实高度与 prefix-sum offset | [TanStack Table Virtualized Rows](https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-rows) · [Virtuoso Auto Resizing](https://virtuoso.dev/react-virtuoso/virtuoso/auto-resizing/) |
| C | 限制最大行高 + 展开 | **Descript**、YouTube、Netflix | 字幕/转写行业默认 **42 字符/行、最多 2 行**；超长文本折叠或进入编辑态展开 | [Descript Edit like a doc](https://help.descript.com/hc/en-us/articles/15726742913933-Edit-like-a-doc) · [Subtitle 42-char rule](https://transcribevoice.app/blog/subtitle-line-length-42-character-rule) |
| D | Edge auto-scroll | **dnd-kit**、**Atlassian Pragmatic drag-and-drop**、Finder | 指针到容器边缘按 **距离比例加速**；threshold 默认 20%，speed 随 proximity 线性/二次增加 | [dnd-kit AutoScroller](https://dndkit.com/extend/plugins/auto-scroller) · [@atlaskit/pragmatic-drag-and-drop-auto-scroll](https://www.npmjs.com/package/%40atlaskit%2Fpragmatic-drag-and-drop-auto-scroll) · [Atlassian Auto-scroll design](https://atlassian.design/components/pragmatic-drag-and-drop/optional-packages/auto-scroll) |
| E | Scroll-to-index + skeleton | **Notion**、Twitter/X | 远距跳转先 scroll 到目标 offset，再渲染目标 + placeholder；不等待全量测量 | 产品观察 / 社区实现 |

### 2.1 长文本：Descript / 字幕行业

- Descript 的脚本编辑器以「edit media like a doc」著称，但转写文本仍按 **段落/语段** 呈现；每行不是无限增长。
- 行业惯例（Netflix/BBC/YouTube）**单行 ≤ 42 字符、每段最多 2 行**，核心原因是阅读速度与屏幕空间。
- 启示：Rushi 的非选中行保持截断是 **可接受产品预期**；关键问题是「选中编辑态」必须可读。

### 2.2 动态测量：TanStack Virtual / react-virtuoso

- `useVirtualizer` 推荐 `estimateSize` + `measureElement`；`measureElement` 读取 `getBoundingClientRect().height`。
- 动态行高会引入：① 首次渲染高度未知导致跳动；② filter / 文本编辑后 cache 失效；③ 滚动条 thumb 大小随测量更新而抖动。
- 启示：全动态（路线 B）**不是 S8 的轻量修复**，属于 L1-C 级重构。

### 2.3 Edge auto-scroll：dnd-kit / Atlassian

- dnd-kit `AutoScroller`：threshold 默认 `{x:0.2, y:0.2}`（容器尺寸 20%），`acceleration` 默认 10，`interval` 默认 5 ms；speed = `base × (distance / threshold)`。
- Atlassian 强调 **distance dampening**：用户可通过把指针移近/移远边缘来控制速度；max speed 在 threshold 内某距离即可达到。
- 启示：Rushi 列表 drag auto-scroll 应采用 **edge threshold + 距离比例速度**，而非固定每帧像素。

### 2.4 远距跳转 / 快连点 / 筛选

- 虚拟列表远距跳转的通用解是：先按估计 offset scroll，再对目标行做二次校正（本仓 `scrollSegmentListIndexToView` 已如此）。
- Notion 等固定高度/预估算产品在远距跳转时也会出现短暂 placeholder，**100% 消除空白需要取消 pin cap 或预渲染**，代价巨大。
- 筛选隐藏选中：产品通常给出 **提示条 + 一键清除过滤并定位**（如 Finder/Notion filter）；激进方案（自动 clear filter）会改变用户查询上下文。

---

## 3. 可复用评估

| 路线 | 可复用到 Rushi 的程度 | 代价 | S8 是否采用 |
|------|----------------------|------|------------|
| A 固定高度 | 已是当前基线 | 低 | **保留** |
| B 动态测量 | 可复用 `measureElement` 思想，但需重写 `segmentListVirtualWindowCore.ts` | 高（2–5d） | **不采用**（归 L1-C） |
| C 行高限制/展开 | 与现有 `transcriptRowHeightPx` 设置、行高拖拽把手语义一致 | 低 | **采用**（选中行溢出可见） |
| D edge auto-scroll | 纯函数 + rAF 循环，可与现有 drag hook 集成 | 中低 | **采用** |
| E skeleton/placeholder | 固定 stride 下 offset 已知，无需 skeleton；保留 160 pin cap | 低 | **保留现状** |

**本仓已有可复用模块**（S8 在其上扩展，未 fork 第二套列表）：

- `segmentListVirtualWindowCore.ts` / `segmentListScrollIntoView.ts` — 虚拟窗、pin cap、scroll-into-view
- `useEditorSegmentListScroll.ts` — P0 projection、scroll generation（L3b 由 S5 覆盖）
- `useTranscriptionLayerSegmentListDrag.ts` — range drag 选区扩展（L2 集成 auto-scroll）
- `useSegmentListFilter.ts` + `EditorSegmentList` — 筛选与 banner 接线

---

## 4. 决策摘要

### 4.1 长文本（对应 L1）

- **v0.1.8 目标**：**仅选中行**长文可读；非选中行保持截断。
- **实现**：选中行虚拟 slot `overflow: visible` + 提升 `z-index`；`maybePinSegmentListVirtualWindow` 在选中行上下各 +1 overscan。
- **刻意不做**：全动态行高（L1-C）、非选中行自动展开（会破坏列表密度）。
- **后续门**：H12 手测失败 → 进入 L1-B 预估行高薄片。

### 4.2 Range drag auto-scroll（对应 L2）

- **v0.1.8 目标**：Shift/拖拽多选可拖到视口外并连续扩展选区。
- **实现**：新建 `segmentListDragAutoScroll.ts`；在 `useTranscriptionLayerSegmentListDrag` pointermove 中检测指针距 `segmentListRef` 顶/底边缘的距离。
- **参数基线**（参考 dnd-kit / Atlassian）：
  - edge threshold：48 px（≈ 容器高度 20% 与 32–72 范围中间值）
  - min speed：4 px/frame
  - max speed：24 px/frame
  - curve：线性 `speed = min + (max-min) × (1 - distance/threshold)`
- **指针离开视口**：仍按住时继续沿方向滚动，并把 hover index 钳位到首/末行。
- **后续门**：H13 手测失败（过快/过慢/拖不出）→ 升级到 L2-B（tier 同款 ease + 共享常量）。

### 4.3 远距跳转 / 快连点 / 筛选（对应 L3）

- **远距（L3a）**：保留 160 行 pin cap + `scrollSegmentListIndexToView` 兜底；接受远距大跳可能有短暂空白。H10 失败才进入 L3-B。
- **快连点（L3b）**：由 P0 + S5 的 projection / scroll generation 解决；S8 不再新增状态机。
- **筛选（L3c）**：实现 S8 banner +「清除过滤并定位」；不自动 clear filter（避免破坏用户查询），也不临时 union selectedIdx（归 L3c-2 后续门）。

### 4.4 总体方案是否调整

- **S8 scope 不扩大**：仍为 L1-A + L2-A + L3-A + L3c-1。
- **唯一调整**：L2-A 的 auto-scroll 从「固定每帧像素」升级为「距离比例速度曲线」，但仍在 S8 估时内。
- **不进入 Phase 1（L1-B/L2-B/L3-B）**：除非 H10/H12/H13/H14 手测失败。

---

## 5. 落位预告

| 文件 | 改动 |
|------|------|
| `EditorSegmentList.tsx` | 选中 slot 条件 `overflow: visible` / `z-index`；pin overscan +1 |
| `useTranscriptionLayerSegmentListDrag.ts` | 集成 edge auto-scroll helper；处理 pointer 离开视口 |
| `segmentListDragAutoScroll.ts`（新） | 纯函数：threshold / speed curve / clamp / step |
| `segmentListDragAutoScroll.test.ts`（新） | threshold 内外、速度曲线、边界钳位 |
| filter banner 组件（新/已有） | `selectedDisplayIndex === -1 && filterActive` 时展示 |
| `waveform-selection-reveal-seek-plan.md` | S8 细节引用本 brief |
| `segment-list-virtual-scroll-upgrade-options.md` | 引用调研来源，确认升级门 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] S8 Plan / Acceptance / 升级选项已链接本文
- [x] grill 确认可进入 S8 编码（2026-06-20）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 初版框架，开始实地调研 |
| 2026-06-20 | 完成调研：填充路线、评估、决策、落位 |
| 2026-06-20 | 互链 Acceptance；grill 签收 S8 编码门禁 |
| 2026-06-20 | §1/门禁同步：S8 已编码、手测 Go；Phase 1 未触发 |

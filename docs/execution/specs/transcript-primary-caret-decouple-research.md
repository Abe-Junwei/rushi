# 调研：语段 primary 与文本 caret 解耦（右键高亮跳下一条）

> **状态**：已采纳（2026-07-15）· spike 已验证 · 手测确认  
> **关联路线图**：编辑器 CM6 语段 SoT / 选中 chrome（横切，非独立路线图薄片）  
> **本实现顶链本文**：`selectionField.ts` · `resolveTranscriptSegmentIdxAtPointer.ts` · `transcriptEditorCoreMount.ts`  
> **关联架构**：[`selection-chrome-bus-research.md`](./selection-chrome-bus-research.md)（历史）· transcript-editor-core P9 CM6 选中 SoT  
> **门禁**：修复类架构调整；编码前对照业内路线，见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 在 CM6 **文本语段正文**上右键打开上下文菜单；高亮应停在点击那条语段。 |
| **本仓现状** | `primarySegmentIdx` **从** `state.selection.main.head` **即时派生** → decorations / gutter / context menu 全部吃 caret 行。右键会触发 contenteditable 原生 caret 放置 + CM `selectionchange` 回写；caret 一旦落到邻行行首，高亮翻到下一条。加重因素：行底 padding / resize 条上 `posAtCoords`、错误坐标系的 `lineBlockAtHeight`，以及右键 mousedown 经 `list` 源桥接 seek/reveal。 |
| **成功标准** | 多语段、行下半部/长换行段第二行右键：primary 不跳；↑↓ / 左键切换 / 多选仍正常；全量 vitest 绿；手测确认。 |

**根因判定（架构）**：行=语段模型下「哪条是 primary」与「文本 caret」是两个概念；把前者派生自后者，无法用 resolver / preventDefault 根治浏览器偶发的 caret 漂移。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | **显式选中 vs 编辑光标分离** | VS Code / Monaco | Selection / cursor 与「当前行/列表项焦点」可独立；装饰读模型态 | [Monaco selections](https://microsoft.github.io/monaco-editor/docs.html) |
| B | **CM6：自定义 StateField + effect 提交** | CodeMirror 6 | 行级多选/主行存 `StateField`；`transactionFilter` / effect 写路径；**不**每帧从 `selection.main` 推导产品行 | [`@codemirror/state` StateField](https://codemirror.net/docs/ref/#state.StateField) · 本仓 `selectSegmentCommand` |
| C | **全面回归 CM 原生 mousedown** | 默认 CM6 | caret/range 全权原生 | 业内默认 — 与 Rushi「行=语段、跨段钳制、frozen、list seek 桥」冲突，ROI 负 |

### 2.1 对照结论

- **C**：段内文本编辑本仓已 `return false` 交给原生；全面迁移会丢掉跨段钳制 / 行级多选 / frozen / list 桥，且**不消除** caret→primary 派生。  
- **B**：合法 primary 变更已全部经 `setTranscriptMultiSelectionEffect`（点击、gutter、↑↓、列表/波形、结构编辑）→ 在 field 内 **捕获并保持** `primaryIdx` 即可解耦，零调用点改动。  
- **A** 精神一致：视觉选中读模型，非读易漂移的原生 caret。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 |
|------|--------|----------------|-------------------|-------------|
| A Monaco | 中 | 「装饰读模型」范式 | 不引入 Monaco | 无 |
| B CM6 StateField | **高** | 已有 `transcriptMultiSelectionField` + `selectSegmentCommand` | 无第二套选中 SoT | 极低 |
| C 原生 mousedown | 低 | 段内拖选已用 | 行模型产品约束 | 复杂度上移到 selection-change |

**本仓已有可复用模块**：

- `selectionCommands.ts` / `selectionField.ts` / `selectionDecorations.ts`
- `transcriptEditorKeymap.ts`（↑↓ → `movePrimarySegmentCommand`，经 effect）
- `segmentContextMenuSelection.ts`（`contextMenu` 源不 seek）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | 在 `TranscriptMultiSelection` **显式存 `primaryIdx`**：effect 提交时捕获；**纯 caret 变化（无 effect、无 docChanged）不改 primary**；`primarySegmentIdx` 优先读显式值。辅以 DOM-first 指针命中（`closest('.cm-line')`）、右键不经 `list` 桥、右键跳过 `posAtCoords` fallback。 |
| **不做什么** | 不全面迁回 CM 原生 mousedown；不新建并行 React 选中真源；不以 resolver 单独当终态。 |
| **与 ADR / architecture** | 延续 CM6 选中 SoT（P9）；修正「primary = caret 行」隐含假设。 |
| **风险与 spike** | Spike：`selectionField` 改写 + 漂移复现测试；全量 2446 tests 绿；手测确认后再终态化。 |

---

## 5. 落位（已实施）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI / CM6 | `selectionField.ts` | 显式 `primaryIdx` |
| UI / CM6 | `resolveTranscriptSegmentIdxAtPointer.ts` | DOM-first 行命中 |
| UI / CM6 | `transcriptEditorCoreMount.ts` · `metaGutter.ts` · `stageGutter.ts` | 右键路径收敛 |
| Service | `segmentContextMenuSelection.ts` | 已 sole primary 跳过重选 |
| 相邻 | `transcriptPointerScrollGuard.ts` · `structureCommands.ts` | 同会话：同行走 scroll 抑制 · 删除后 primary 保留 |
| 测试 | `selectionField.test.ts` 等 | 漂移 · context-menu 路径 · gutter 右键 |

---

## 6. 签收

- [x] 调研 brief 完成（终态回写）
- [x] spike + 全量测试 + 手测确认
- [x] 可进入提交 / 后续文档索引

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-15 | 初版；采纳 B；记录 spike 与实现落位 |

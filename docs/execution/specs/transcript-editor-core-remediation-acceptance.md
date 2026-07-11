# 验收：Transcript Editor Core 整改

> **调研**：[`transcript-editor-core-remediation-research.md`](./transcript-editor-core-remediation-research.md)  
> **计划**：[`transcript-editor-core-remediation-plan.md`](./transcript-editor-core-remediation-plan.md)  
> **手测总清单（勾选用）**：[`transcript-editor-core-handtest-checklist.md`](./transcript-editor-core-handtest-checklist.md)  
> **说明**：本功能属**编辑器交互/正确性**横切，非能力（环境/ASR/设置）门控功能，故 **能力—UI 状态矩阵 N/A**；改以下三张矩阵验收。手测步骤与勾选框以 **handtest-checklist** 为准，本文件保留矩阵定义与签收状态。

---

## 0. 机器门禁（每阶段 + 终态）

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
```

- [x] 全绿；guard 无新 hotspot（P9 前允许旧栈并存）。
- [x] 新增守卫：除 core 选区/结构允许列表外禁止写 `setTranscriptMultiSelectionEffect`（单向数据流）。
- [x] 新增守卫：禁止复活 `selectionChromeStore` / `publishSelectionChrome` / `useSegmentDraftStore`；`setSegmentMetaEffect` 仅 core allowlist（bounds 经 `dispatchTranscriptSyncMetaFromSegments`）。
- [ ] 新增守卫：除 persistence / 已 CM6-dispatch 的 controller 外禁止裸 `publishTextBulk`（持续收紧；本轮已修 Stage B / correction / undo / bounds 旁路）。

---

## 1. 三个核心 bug 复测（编辑—聚焦矩阵 E）

| # | 步骤 | 期望 | 现状（回归基线） |
|---|------|------|------------------|
| E-1 | 单击任意语段 | 立即进入编辑态、**光标闪烁可见** | 曾无光标/进不去 |
| E-2 | 双击语段词 | 选中词、可编辑 | 曾无反应 |
| E-3 | 编辑中删除一个字符 | **保持编辑态、不 blur** | 曾删字即丢焦 |
| E-4 | 编辑中按 **空格** | 在文本插入空格，**不触发播放** | 曾误触 play |
| E-5 | 编辑中按 **回车** | 按既定语义（换行禁用 → 确认/前进或忽略），**不误触播放** | 曾误播 |
| E-6 | 中文 IME 连续输入 | 无丢字、光标不跳、组合态正确 | — |
| E-7 | 连按 ↑/↓ 20 次跨语段 | 选中平滑跟随、不卡、不丢焦到全局 | — |

**全部为终态硬性通过项（P3/P8）。**

---

## 2. 选区一致性手测矩阵（SC-H1–H12）

沿用 `selection-chrome-bus` 手测语义，真源改为 CM6：

| # | 场景 | 期望 |
|---|------|------|
| SC-H1 | 列表单击 | primary=该段，唯一选中 |
| SC-H2 | 波形单击语段 | 列表同步选中 + seek 到段首 |
| SC-H3 | Cmd/Ctrl+单击 | toggle 多选，primary 更新 |
| SC-H4 | Shift+单击 | anchor→target 区间选中 |
| SC-H5 | ↑/↓ | primary 移动，单选替换 |
| SC-H6 | Shift+↑/↓ | 区间扩展 |
| SC-H7 | 选中后滚动出视口再回 | 选区视觉正确（虚拟化不丢态） |
| SC-H8 | filter/隐藏部分段 | 不可见段不画；banner/计数正确 |
| SC-H9 | split 段 | 选区落在合理段，时间戳正确 |
| SC-H10 | merge 段 | 选区/时间戳/持久化正确 |
| SC-H11 | delete 段 | 选区回落相邻段 |
| SC-H12 | 波形拖拽调整边界 | 选中段边界更新，列表/持久化同步 |

- [x] 全部通过；波形 ↔ 列表**双向零 desync**（无需 reconcile 即一致）。（2026-07-11 用户手测）

---

## 3. 性能门禁（`__rushiSelectionProfile`）

| 指标 | 达标线 | 素材 |
|------|--------|------|
| 选区切换 firstPaint | 主观 <50ms | 193 段 + 2000 段 |
| 选区切换总延迟 P95 | **≤ 现状 `listCommit`（≈400ms）**，目标显著更优（CM6 视口虚拟化） | 2000 段 |
| 滚动 FPS | ≥50 FPS（Chromium spike 实测） | 2000 段 |
| Windows WebView2 + CJK IME | **P0 显式跳过**（无 Windows，2026-07-10）；改为 **Windows 发版前硬门禁**。编码默认 `EditorView.EDIT_CONTEXT = false`。补测矩阵仍见 `__spike__/README.md` | Windows 11 + WebView2 + 长段中文（发版前） |
| meta rail 锁步 | gutter/lineMarker 优先；Chromium spike：`gutterMaxAbsDeltaPx=0` 通过。block widget / side-rail 仅 fallback | 2000 段 |
| 历史换行审计 | **策略定稿**：可逆 U+240A 编码；禁止静默替换。生产导出复核为加分项 | fixture + 可选真实导出 |

- [ ] P0 spike 报告已填 research §7 并达标（否则回退路线 A）。
- [ ] research §7 只包含真实运行数据；未跑出的数字不得占位或推断填写。
- [ ] 终态 profile 不劣于回归基线。

---

## 4. 架构/清理签收（P9）

### P9a（列表旧栈 · 2026-07-10）

- [x] Filter→CM6（全文 + 隐藏非匹配行）；无 textarea 虚拟列表路径。
- [x] `EditorSegmentListViewport` / `SegmentRowTextField` / `useSegmentRowTextField*` / 行 reconcile 已删。
- [x] flag 恒 on；`desktop-waveform-engine.md` §点选契约改写；`selection-chrome-bus-research.md` 顶部标注被取代。
- [x] 手测：开 filter → 只见匹配行、↑↓ 不进隐藏段、清 filter 恢复；SC-H8。（2026-07-11）

### P9b（SC1/SC2 桥）

#### P9b1（overlay/手势 · 2026-07-11）

- [x] Overlay 行高亮读 `transcriptProjection`（与 band 对齐）。
- [x] gesture/drag/keyboard nav 锚点改 `effectiveTranscriptPrimaryIdx`。
- [x] 删 `leadingSc1` / `selectionChromeMatchesPreview` / imperative 列表分支 / burst 死 API。

#### P9b2（2026-07-11）

- [x] 无第二套可写选区真源；`startTransition` 选区编排 / publish SC2 / `runSelectSegmentAt` 已删。
- [x] 会话内选区写入口只有 CM6 transaction（`dispatchTranscriptEditorSelection*`）；ctx `selectedIdx` 为投影镜像。
- [x] 每行 `<textarea>` + `useSegmentDraftStore` + `epoch 重挂` 已删（P9a/P9b2b）。

#### P9b2b（2026-07-11）

- [x] `useSegmentDraftStore` / draft dirty overlay 删除；save/close/autosave/dirty 仅 segments vs saved。
- [x] `flushCm6TextProjection` / `flushTranscriptTextProjection` 在 save/export/structure 前同步 CM6 正文。

---

## 5. 数据/持久化验收

| # | 场景 | 期望 |
|---|------|------|
| D-1 | `SegmentDto[] → CM6 state → SegmentDto[]` round-trip | uid/start/end/stage/speaker/text 恒等（按 P0 换行策略处理） |
| D-2 | CM6 文本 transaction | dirty/autosave/undo 只由 `transactionPersistenceBridge` 触发，序列化投影正确 |
| D-3 | split/merge/delete/insert transaction | meta 与文本同步变更，undo/redo 与持久化正确 |
| D-4 | 外部 controller 尝试直接改段文本/结构 | flag on 路径被迁移或 guard 阻止，不形成第二写入口 |
| D-5 | 含换行历史文本 fixture | 按审计策略处理，禁止静默 `replace(/\\n/g,\" \")` |

---

## 6. 签收

手测勾选请在 [`transcript-editor-core-handtest-checklist.md`](./transcript-editor-core-handtest-checklist.md) 完成，通过后在此汇总：

- [x] E-1..E-7 全过
- [x] SC-H1..SC-H12 全过
- [x] 性能门禁达标（本机主观；机器侧见 research §7）
- [x] D-1..D-5 全过（含 handtest §3 展开项）
- [x] 架构清理签收
- [x] 用户手测确认（handtest §6 汇总已勾；2026-07-11）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-10 | 初版 |
| 2026-07-10 | P8：默认 on（`"0"` 关闭）；选区写守卫；typecheck+2138 tests+guard 0 错；全仓 lint 仍有既有债；E/SC 手测待确认 |
| 2026-07-10 | P9a：Filter→CM6；删 Viewport/textarea 行栈；flag 恒 on；点选契约文档改写；P9b 留 SC1/SC2 桥 |
| 2026-07-11 | P9b1：overlay/手势改读 projection；删 leadingSc1 与 SC2 死路径；P9b2 留 selectedIdx/store |
| 2026-07-11 | P9b2：删 SC1/SC2 可写桥；`selectSegmentTransport` + projection 镜像；draft 留 P9b2b |
| 2026-07-11 | P9b2b：删 draft store；`flushCm6TextProjection`；dirty/autosave 仅 snapshot |
| 2026-07-11 | 审查修复：Stage B/undo/correction CM6-first；bounds→meta sync；retired-SoT + meta 写守卫；CONTEXT/waveform-engine 去 SC 双真源 |
| 2026-07-11 | 手测总清单：[`transcript-editor-core-handtest-checklist.md`](./transcript-editor-core-handtest-checklist.md)（冒烟 + E/SC/D/性能/发版前） |
| 2026-07-11 | **用户手测签收**：handtest §0–§4 全过；§5 W-2 过；W-1 Windows IME 仍为发版前硬门禁 |

# 计划：Transcript Editor Core 整改（分阶段落地）

> **调研门禁**：本计划实现前提为 [`transcript-editor-core-remediation-research.md`](./transcript-editor-core-remediation-research.md) 已采纳 **且 P0 spike 通过**（否则回退路线 A）。
> **验收**：[`transcript-editor-core-remediation-acceptance.md`](./transcript-editor-core-remediation-acceptance.md)  
> **手测总清单**：[`transcript-editor-core-handtest-checklist.md`](./transcript-editor-core-handtest-checklist.md)  
> **状态**：本机手测签收 ✅（2026-07-11；§0–§4 全过；Windows W-1 发版前再测）  
> **执行纪律**：单人短循环（每轮 2–4h、一个纵向薄片），每轮结束必过 `npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs`；每阶段独立可回滚、feature flag 并存新旧。

---

## 0. 目标形态（一句话）

> **CM6 的 `EditorState` = 转写唯一真源**（文本 + 语段元数据 + 选区）。列表行、meta 列、波形、seek/reveal 全部**单向派生**自它。**删除** SC1 React 选区 state、SC2 可写 chrome store、reconcile、leadingSc1、startTransition 选区编排、每行 textarea + draft + epoch 重挂。

数据流（对照现状「双真源 + 弥合」）：

```
交互(click/键盘/波形/打字/split)
        │  dispatch transaction
        ▼
  CM6 EditorState  ← 唯一真源(doc 文本 + SegmentMeta StateField + selection + multiSelect StateField)
        │  updateListener(单向)
        ├─▶ CM6 视口渲染(行文本/光标/高亮 decoration) —— 内建虚拟化
        ├─▶ CM6 meta rail(gutter/line marker 优先，block widget 次选，React side-rail 仅 fallback)
        ├─▶ transcriptProjection store(primaryIdx/selectedSet/meta) ─▶ 波形 band/overlay/scroll
        ├─▶ reveal/seek(Transport Authority：读 primary)
        └─▶ segments 序列化投影(debounce，只读派生)─▶ 持久化/undo/dirty/autosave
```

**权威边界**：feature flag on 后，会话内所有文本编辑、结构变更、选区变更只允许通过 CM6 transaction 写入。`SegmentDto[]` 仍是保存/导入/导出的格式，但在编辑会话内只是从 CM6 派生的序列化投影，不能作为第二个可写真源。

---

## 1. 并存策略（贯穿全程）

- feature flag `transcriptEditorCore`（localStorage；**P8 起默认 on**，`"0"` 关闭）。
- flag on → 渲染新 `TranscriptEditorCore`；off → 现 `EditorSegmentListViewport`。二者共用同一 `SegmentDto[]` 数据源与持久化 API。
- 每阶段结束：**两条路径都要绿**（新特性在 flag on 下可用，flag off 行为不回归）。
- 达到 acceptance 全绿并手测通过 → 翻默认为 on（灰度一轮）→ 最后阶段删旧栈与旧测试。

---

## 2. 阶段分解（每阶段 = 落位文件 + 退出判据）

### P0 — 可行性 spike（**阻塞门禁**，见 research §4.1）
- **落位**：`apps/desktop/src/components/editor/core/__spike__/`（临时，不进主干终态）；复用 `__rushiSelectionProfile`。
- **做**：CM6 doc(N 行) + line decoration 选区 + **CM6 gutter/line marker 元信息列**（时间戳/badge/拖拽把手/右键菜单入口/find 高亮/长文本换行/字号变化/可变行高）同 DOM 视口锁步；若不可行，依次验证 block widget、React side-rail + rAF DOM scroll 同步；使用接近真实的滚动容器、tokens/CSS、行间距与面板层级；2000 段度量选区延迟/滚动 FPS；审计历史 `SegmentDto.text` 是否含换行。**Windows WebView2 + CJK IME：P0 显式跳过**（无 Windows 环境）；编码默认 `EditorView.EDIT_CONTEXT = false`；Windows 发版前补测，失败则回退 A。
- **换行策略（P0 定稿）**：段内换行可逆编码为 U+240A；serialize 还原；禁止静默空格替换。生产导出复核为加分项。
- **退出**：research §4.1 本机项达标（IME 除外）→ 写 spike 报告(research §7)、用户确认；否则回退路线 A（另立 plan）。
- **API 注意**：Spike 代码以当前 CM6 文档/API 为准（如 `tr.selectionSet` / `tr.docChanged` / `StateField.update` / `EditorView.decorations` / gutter API / `EditorView.contentAttributes` / `EditorView.EDIT_CONTEXT`），外部伪代码只作架构草图，禁止照搬非标准字段或用 `EditorView.theme` 设置 DOM 属性。

### P1 — 编辑器内核骨架（flag off 下不可见）
- **落位**（新目录 `components/editor/core/`）：
  - `buildTranscriptEditorState.ts`：`SegmentDto[]` → `EditorState`（doc = 各段文本以 `\n` 连接；换行强约束：先执行 P0 换行审计策略，禁止静默 `replace(/\n/g," ")` 破坏用户文本）。
  - `segmentMetaField.ts`：`StateField<SegmentMeta[]>`（uid/startSec/endSec/stage/speakerId/rowHeight?），随 doc 变更映射。
  - `serializeTranscriptEditorState.ts`：doc + meta → `SegmentDto[]`（映射回持久化）。
  - `transactionPersistenceBridge.ts`：CM6 transaction → dirty/autosave/undo 的唯一桥；先支持最小文本变更，后续结构变更沿用同一桥。
  - 单测：round-trip（segments → state → segments 恒等）、含空段/首尾/多字节/emoji/换行策略；transaction 后序列化投影正确。
- **退出**：round-trip 与 transaction→投影单测绿；确认 flag on 路径不存在直接 mutate `SegmentDto[]` 的编辑入口；typecheck 绿。

### P2 — 选区成为唯一真源
- **落位**：
  - `selectionField.ts`：`StateField<Set<lineIdx>>` 多选 + rangeAnchor；primary = `state.selection.main` 所在行。
  - `selectionCommands.ts`：`selectSegment / toggle(cmd) / range(shift) / moveUp / moveDown`（吸收 [`resolveSelectionChromePreview.ts`](../../../apps/desktop/src/services/selection/resolveSelectionChromePreview.ts) 语义 + [`useSegmentSelectionController.selectSegmentAt`](../../../apps/desktop/src/pages/useSegmentSelectionController.ts)）。
  - `selectionDecorations.ts`：primary/inSelection 行 decoration（取代 `.seg-row-selected` imperative）。
  - `transcriptProjection.ts`（新投影 store）：CM6 `updateListener` → `{ primaryIdx, selectedSet, metaVersion }`，`useSyncExternalStore` 暴露。
- **退出**：flag on 下点击/↑↓/shift/cmd 多选正确；选区**只**来自 CM6；任何波形/快捷键/右键入口只能 dispatch selection command，不能写投影 store 或 `SegmentDto[]`；单测覆盖命令矩阵。

### P3 — 行内编辑（根治 blur/光标）
- **落位**：CM6 原生编辑即完成文本录入；`onDocChanged.ts` 将行变更 debounce 映射为段文本更新（喂现 dirty/autosave/persist）。
- **退出（关键 bug 复测）**：点击/双击必现光标；删字、打字、按空格/回车**不丢焦、不误播**（acceptance E-1..E-6）；中文 IME 稳。
- **说明**：CM6 拥有 DOM/焦点/光标，`useSegmentRowTextField*`/`useSegmentDraftStore`/`focusTranscriptSegmentTextarea`/epoch 重挂在 flag on 路径**不再参与**。
- **进度（2026-07-10）**：✅ 代码落地 — `TranscriptEditorCore` + `EditorSegmentList` flag 分支；`isTranscriptTextEditTarget` / `editorFocusGate` 认 CM6；单测 `onDocChanged.test.ts` 绿。手测 E-1..E-6 需 `localStorage.setItem("rushi.dev.transcriptEditorCore","1")` 后确认。

### P4 — meta 列（CM6 视口内）与滚动
- **落位**：优先用 CM6 gutter/line marker 承载时间戳、stage badge、speaker、拖拽把手、行高手柄；若 P0 证明不可行，再用 block widget；React `TranscriptMetaRail.tsx` side-rail 仅作最后 fallback，且必须 rAF 同步 DOM scrollTop、不得依赖 React 状态节奏。reveal/scroll 用 CM6 `EditorView.scrollIntoView`（取代 `useEditorSegmentListScroll` + 虚拟窗）。
- **退出**：视觉与旧列表等价；长表滚动不掉帧；选中 reveal 到位。
- **进度（2026-07-10）**：✅ 薄片 — `metaGutter.ts`（序号+时间戳+stage 文案）+ `revealSegment.ts`；已接入 `transcriptEditorCoreExtensions` / `TranscriptEditorCore`；选区默认 `scrollIntoView`。余量：拖拽把手、行高手柄、speaker、与旧列表视觉像素级对齐。
- **进度（续）**：✅ P4 余量 — 左 gutter 仅序号+时间（选中色）；右 gutter stage chip；meta 列宽拖拽复用 appearance；字体/字重/斜体/行密 theme；`finalizeVia` 入 meta。**明确降级**：speaker（无 DTO/旧 UI）；行内行高手柄（全局字号拖调已覆盖，底部 ResizeBottomHit 仍可用）。

### P5 — 波形接线
- **落位**：波形 band/overlay/scroll 改订阅 `transcriptProjection`（替换 `resolveWaveformSelectionChromeView` 的 SC1/SC2 读法）；seek/play 读 CM6 primary，保持 Transport Authority。
- **退出**：波形点选 ↔ 列表选中双向一致；seek/play 顺序正确（不从 chrome 推断 already-sought）。
- **进度（2026-07-10）**：✅ flag-on 读投影；`dispatchTranscriptEditorSelection` + view handle；gesture/runSelectSegmentAt/playback/Space 用 `effectiveTranscriptPrimaryIdx`；波形→CM6 写回；list scroll 用 `revealSegmentInView`。SC1 bridge（list→seek）仍保留至 P9；filter 路径仍走旧 SC1/SC2。

### P6 — 结构变更（split/merge/delete/insert）
- **落位**：`structureCommands.ts`：split=行拆分 + meta 拆分 + 时间中点；merge=行合并；delete/insert 同理；统一走 P1 的 `transactionPersistenceBridge` 触发持久化/dirty/autosave/undo。撤销策略在 P1/P2 已定：**优先禁用 CM6 history、沿用现 undo**（CM6 transaction 序列化为段 mutation → 现 undo 栈）；若 P1 验证不顺再评估 CM6 history。
- **退出**：split/merge/delete/insert 后选区、时间戳、持久化、undo 正确。
- **进度（2026-07-10）**：✅ split/merge/delete（含 range + 稀疏 indices）+ insert（after / waveform time-range）均走 CM6 structure transaction → `persistTranscriptStructureFromView`。策略校验仍在 `segmentMutationInsert` / gap-policy。

### P7 — find/replace · 纠错规则 · 右键菜单 · 快捷键
- **落位**：find/replace 高亮改 CM6 mark decoration；[`useFindReplaceController`](../../../apps/desktop/src/pages/useFindReplaceController.ts)/[`useCorrectionRulesController`](../../../apps/desktop/src/pages/useCorrectionRulesController.ts) 作用于 CM6；右键菜单在 CM6 上取选区（删 `transcriptSelection` 缓存/blur 兜底）；快捷键 dispatcher 与 CM6 keymap 协调（编辑态内快捷键归 CM6，全局仍生效但不再因丢焦误触）。
- **退出**：四条链路 flag on 下等价旧行为。
- **进度（2026-07-10）**：✅ panel highlight field；text replace/bulk CM6 commands；find/replace + correction writeback 先 dispatch CM6；focus match → reveal；CM6 contextmenu + `transcriptSelection` 读 CM6 选区；快捷键已把 CM6 当 inTextarea。

### P8 — 翻旗 + 灰度
- 默认 `transcriptEditorCore = on`；跑 acceptance 全量 + 手测矩阵；观察一轮。
- **退出**：acceptance 全绿、三 bug 复测通过。
- **进度（2026-07-10）**：✅ 默认 on；P9a 起 flag **恒 true**（无 opt-out）。架构守卫禁止 core 外写 `setTranscriptMultiSelectionEffect`。机器门禁本轮跑通；E/SC 手测矩阵仍需用户确认。

### P9a — Filter→CM6 + 删列表旧栈（2026-07-10 ✅）
- Filter = 全文 CM6 + `filterLineVisibility` 隐藏非匹配行（保留 idx 映射）；`EditorSegmentList` 仅挂 `TranscriptEditorCore`。
- 导航/滚动：`revealSegmentInView`；键盘 focus 走 CM6 `view.focus()`。
- **已删**：`EditorSegmentListViewport`、虚拟窗 scroll 栈、`SegmentTextListRow` / `SegmentRowTextField` / `useSegmentRowTextField*`、`useReconcileSelectionChromeFromReact` + service reconcile、textarea focus 重试链。
- **暂留（P9b）**：`selectedIdx` / `useSelectedIdxCommitter` / `runSelectSegmentAt` / `selectionChromeStore` / `flushSegmentTextDrafts` / `useSegmentDraftStore`。
- **文档**：`desktop-waveform-engine.md` §点选契约改写；`selection-chrome-bus-research.md` 顶部取代横幅。

### P9b1 — Overlay/手势改读 projection（2026-07-11 ✅）
- `useSegmentRowSelection` / overlay region 高亮订阅 `transcriptProjection`（不再读 SC2）。
- gesture / overlay / drag / keyboard nav / burst reveal 锚点改 `effectiveTranscriptPrimaryIdx`。
- 已删：`selectionChromeMatchesPreview`、`leadingSc1`、burst 虚拟列表死 API、`applySelectionChromeImperative` 列表行分支。
- **暂留（P9b2）**：`selectedIdx` / `runSelectSegmentAt` / burst SC1 deferral / `selectionChromeStore` + publish（仍可写，overlay 已不读）。

### P9b2 — 删 SC1/SC2 过渡桥（2026-07-11 ✅）
- **已删**：`useSegmentSelectionController` / `useSelectedIdxCommitter` / `useWaveformKeyboardSelectionCommit` / `runSelectSegmentAt`；`selectionChromeStore` / `publishSelectionChrome*` / `applySelectionChromeImperative` / `selectionChromePublishBridge`。
- **替换**：`selectSegmentTransport`（CM6 dispatch + seek/reveal）；`useTranscriptSelectionFromProjection`（ctx 选区字段为投影镜像）；多选写入口 `dispatchTranscriptEditorSelection*`。
- **暂留（P9b2b 前）**：`flushSegmentTextDrafts` / `useSegmentDraftStore`（已由 P9b2b 清掉）；`listKeyboardBurstCoordinator`（keyup reveal 时序，无 SC1 commit）。
- **退出**：guard 无孤儿、无死代码；全绿。

### P9b2b — draft/save 改 CM6 flush（2026-07-11 ✅）
- **已删**：`useSegmentDraftStore` / `segmentDirtyRead`；DOM textarea draft flush。
- **替换**：`flushCm6TextProjection` / `flushTranscriptTextProjection`（save/export/structure 前同步 CM6→`SegmentDto[]`）；dirty/autosave/footer 仅 snapshot 比较；IME 中跳过 autosave（`view.composing`）。
- **退出**：guard 无孤儿；全绿。

### P9b — 删 SC1/SC2 过渡桥（总览；拆为 P9b1/P9b2）
- **P9b1 + P9b2 + P9b2b 已完成**。

### P9 — 删旧栈（总览；拆为 P9a/P9b）
- 原整包 P9 见上；**P9a 已完成**，剩余见 P9b。
- **文档**：改写 `desktop-waveform-engine.md` §点选契约为「CM6 单真源 + 单向波形投影」；旧 `selection-chrome-bus-research.md` 顶部加「已被本 spec 取代」横幅。删对应过时测试。
- **退出**：guard 无孤儿、无死代码；全绿。

---

## 3. 关键设计约束

- **一行一段、文本禁含换行**：先审计历史数据；根据 P0 结论采用可逆编码/显式拒绝/一次性迁移之一，禁止静默替换；行数 == 段数是内核不变量（P1 单测守卫）。
- **单写入口**：feature flag on 后，会话内文本/结构/选区只通过 CM6 transaction 写入；`SegmentDto[]` 仅是序列化投影。
- **单向数据流**：除用户交互 dispatch 外，任何模块**不得**反向写选区（无 reconcile）。守卫：`check-architecture-guard.mjs` 增规则——除 `selectionCommands.ts` 外禁止写 selection/multiSelect field，除 `transactionPersistenceBridge.ts` 外禁止 flag on 路径直接 mutate segment text/structure。
- **Transport Authority 不变**：seek/play 读 CM6 primary，不从投影/视觉推断。
- **持久化不变**：对外保存/导入/导出格式仍是 `SegmentDto[]`；CM6 是会话内编辑真源，save/undo 经序列化桥生成 `SegmentDto[]` 投影。

## 4. 风险与回退

| 风险 | 对策 |
|------|------|
| P0 不达标 | 回退路线 A（单 store + textarea），另立 plan；本 plan 冻结 |
| 富行/可变行高在 CM6 表达难 | P0 先证；gutter/line marker 优先，block widget 次选，React side-rail 仅 fallback |
| undo 与 CM6 history 冲突 | P1/P2 即定边界：默认沿用现 undo、禁 CM6 history；结构变更不得另走临时桥 |
| CM6 state / `SegmentDto[]` 形成新双真源 | 单写入口 + guard：flag on 路径只能 dispatch CM6 transaction，`SegmentDto[]` 只作为序列化投影 |
| 历史换行文本被破坏 | P0 审计 + 明确策略；禁止静默替换 |
| 大改期回归 | feature flag 并存 + 每阶段双路径绿 + 逐特性迁移 |
| 测试大改（~40 文件） | 随阶段改写；P9 统一清死测 |

## 5. 验证（每阶段）

`npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs` + 该阶段 acceptance 条目 + 至少一条手测主路径（三行日志：改动/验证/下一轮）。

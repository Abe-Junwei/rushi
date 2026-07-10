# 调研：Transcript Editor Core 整改（选区/编辑单一真源 + 成熟编辑器内核）

> **状态**：已采纳 · **P9a/P9b1/P9b2/P9b2b 完成** · 下一阶段手测签收  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) — 编辑器交互 perf / 正确性横切  
> **关联 spec**：[`transcript-editor-core-remediation-plan.md`](./transcript-editor-core-remediation-plan.md) · [`transcript-editor-core-remediation-acceptance.md`](./transcript-editor-core-remediation-acceptance.md)（编码前须链接本文）  
> **取代关系**：本文 **取代** [`selection-chrome-bus-research.md`](./selection-chrome-bus-research.md) 的核心决策「保留 `selectedIdx` React state + SC2 chrome 双写 + reconcile」。原决策把「Descript 式全文档模型（路线 E）」列为非目标；本文将其**改为选定方案**（详见 §4）。  
> **关联架构**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)（§点选契约 / SC1·SC2 / Transport Authority）  
> **门禁**：P0 本机达标 + 用户签字（2026-07-10）后进入 P1；Windows IME 为发版前硬门禁（见 §7）

---

## 0. 为什么重开调研（触发）

近多轮反复出现同一类 bug，且「加护栏」均无法根除：

- 点击/双击语段**看不到光标闪烁、进不去编辑**；
- 编辑中**删一个字符即丢失编辑态**（textarea blur）；
- 编辑中**按空格/回车触发播放**（全局快捷键截获，因为焦点已丢）。

根因已定位（非表面 bug）：选区存在**两个真源**，靠时序弥合，弥合窗口内任何重渲染都可能把「正在编辑的聚焦行」拉回旧真源 → `selected` 翻 `false` → 触发 deselect blur（[`useSegmentRowTextFieldEditing.ts:117–123`](../../../apps/desktop/src/hooks/useSegmentRowTextFieldEditing.ts)）→ 丢光标 → 空格落到波形 play toggle。

| 真源 | 位置 | 谁写 |
|------|------|------|
| **SC1** 逻辑选中 | React `useState`：[`useProjectEditorState.ts:34`](../../../apps/desktop/src/pages/useProjectEditorState.ts) `selectedIdx` + [`useSegmentSelectionController.ts:26`](../../../apps/desktop/src/pages/useSegmentSelectionController.ts) `selectedIndices` | 各 committer 经 `startTransition` |
| **SC2** 视觉 chrome | 外部 store：[`selectionChromeStore.ts`](../../../apps/desktop/src/services/selection/selectionChromeStore.ts) + imperative DOM 双写 [`applySelectionChromeImperative.ts`](../../../apps/desktop/src/services/selection/applySelectionChromeImperative.ts) | `publishSelectionChrome` 抢跑 |

弥合机制：[`reconcileSelectionChromeFromReact.ts`](../../../apps/desktop/src/services/selection/reconcileSelectionChromeFromReact.ts) + `leadingSc1PrimaryIdx` 守卫 + committer 的 `startTransition`。**只要双真源在，缝就在。**

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 长转写（90–数千语段，多小时音频）编辑：波形/列表点选、键盘 ↑↓ 连按、进入行内编辑打字（含中文 IME）、split/merge/delete、find/replace。期望：点击 <50ms 高亮、**编辑态稳定不丢焦、打字不误触全局快捷键**、连按不卡。 |
| **本仓现状** | 见 §0：SC1/SC2 双真源 + 弥合层；文本行是**每行一个 `<textarea>`**（[`SegmentRowTextField.tsx`](../../../apps/desktop/src/components/segmentRow/SegmentRowTextField.tsx)），靠 `key={draftKey}@epoch` **重挂**同步、`useSegmentDraftStore` 存草稿、`focusTranscriptSegmentTextarea` rAF 重试兜底聚焦；列表自建虚拟化（[`segmentListVirtualWindowCore.ts`](../../../apps/desktop/src/utils/segmentListVirtualWindowCore.ts)，≥90 段启用），会 unmount/remount 行 → 销毁 textarea DOM。 |
| **成功标准（可手测）** | ① 任意语段点击/双击必现光标、可编辑；② 编辑中删字、打字、按空格/回车**不丢焦、不误播**；③ 2000 段文件选区切换 P95 ≤ 现状 `listCommit`，滚动不掉帧；④ SC 手测矩阵（[acceptance](./transcript-editor-core-remediation-acceptance.md) SC-H1–H12）全过。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | **单一 store 真源 + 行级订阅（保留 textarea）** | TanStack Virtual / Virtuoso + external store | 选区收敛为一个 `useSyncExternalStore`；删 SC1 useState 与 reconcile；行按 index 订阅只重渲变化行；**不换文本内核** | [TanStack Virtual](https://tanstack.com/virtual/latest) |
| B | **CodeMirror 6 — 单 EditorState + decoration + 内建视口虚拟化** | VS Code(Monaco 同族思想) / CodeMirror | 全文一份 `EditorState`；选区/光标/高亮=selection + `StateField`/decoration；**只渲染可见视口行**（不可关闭）；IME/光标由内核保证 | [CM6 docs](https://codemirror.net/docs/) · 虚拟化：[view viewport](https://codemirror.net/docs/ref/#view.EditorView.viewport) · 维护者确认「只渲染视口、不可关」[discuss](https://discuss.codemirror.net/t/how-can-make-sure-the-whole-document-is-always-rendered-in-codemirror6/5241) |
| C | **ProseMirror — 结构化文档节点 + transaction** | Notion 类 / Tiptap | 每语段=带 attrs 的 node（start/end/uid/stage）；编辑=transaction；语义最贴合 split/merge | [ProseMirror docs](https://prosemirror.net/docs/) |
| D | **Lexical — 不可变 EditorState + node** | Meta Lexical | 单 state、node/decorator、部分 windowing | [Lexical](https://lexical.dev/) |
| E | **Transcript + timeline 双视图（文档模型真源）** | [Descript](https://help.descript.com/hc/en-us/articles/15726742913933-Edit-like-a-doc) / Otter | 脚本与时间轴共享**一个文档模型**；选区/编辑在文档，波形只是投影 | 产品观察 |

### 2.1 关键事实（已核实，决定取舍）

| 事实 | 证据 | 影响 |
|------|------|------|
| **CM6 内建视口虚拟化，只渲染可见行，不可关闭** | 维护者 marijn：「there's no way to change this…making it bigger would make the editor less responsive」[discuss #8825](https://discuss.codemirror.net/t/improve-scroll-performance-tradeoff/8825) | 上千语段 **免费拿到虚拟化**；无需自建虚拟窗 |
| **ProseMirror 整篇进 DOM、无虚拟化、intentionally out of scope** | 维护者 marijn：「The library puts the entire document in the DOM」「viewporting…intentionally out of scope」[discuss #4972](https://discuss.prosemirror.net/t/improving-performance-loading-on-scroll/4972) · [#577](https://discuss.prosemirror.net/t/efficient-viewport-rendering-like-codemirror/577) | 多小时转写会因浏览器 layout 变慢；虚拟化须自建（高风险） |
| **CM6/Descript 均已验证：单文档模型可承载「文本+时间轴」而选区不双真源** | Descript「edit like a doc」；CM6 selection 即真源 | 支撑「删双真源」根治路线 |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------|-------------------|---------------------|
| **A** 单 store + textarea | **中** | 现 `selectionChromeStore` 升级为唯一真源；行 `useSyncExternalStore` 已在 [`useSegmentRowSelection.ts`](../../../apps/desktop/src/hooks/useSegmentRowSelection.ts) | **不解决**文本内核问题（textarea 重挂/blur/draft/epoch/focus 重试仍在）→ 删字丢焦风险只被弱化不根除 | 改动中；虚拟化仍自建 |
| **B** CodeMirror 6 | **高** | 视口虚拟化、IME/光标/selection、decoration（高亮）、history、gutter/line marker/widget | 语段=行（文本不含换行需强约束，**须先审计历史数据，禁止静默改写用户文本**）；富 meta 列（时间戳/stage/拖拽/行高）优先验证 **CM6 gutter / line marker**，其次 block widget，React side-rail 仅作最后兜底；持久化仍 `SegmentDto[]`，但会话内写入口必须收敛到 CM6 transaction，避免形成 `CM6 state / SegmentDto[]` 新双真源 | 内建虚拟化省内存；成熟稳定 |
| **C** ProseMirror | **中** | node attrs 天然表达语段元数据；split/merge=transaction | **无虚拟化**（§2.1）→ 多小时转写须自建虚拟化，风险最高；React nodeView 集成额外成本 | 长文档 layout 慢 |
| **D** Lexical | **中低** | 单 state 思路 | windowing 不如 CM6 成熟；生态偏富文本 | — |
| **E** Descript 双视图 | **概念** | 目标形态参照（文档为真源） | 是「目标」不是「库」，须落到 B/C 之一 | — |

**本仓已有可复用模块（扩展/吸收，不 fork 第二套）：**

| 模块 | 路径 | 在新架构中的去向 |
|------|------|------------------|
| 选中唯一入口内核 | [`useTranscriptionLayerSelection.ts`](../../../apps/desktop/src/pages/useTranscriptionLayerSelection.ts) / [`runSelectSegmentAt.ts`](../../../apps/desktop/src/pages/runSelectSegmentAt.ts) | 折叠为 CM6 selection 命令 |
| 波形 band/overlay 投影 | [`resolveWaveformSelectionChromeView.ts`](../../../apps/desktop/src/services/selection/resolveWaveformSelectionChromeView.ts) · [`WaveformSegmentBandCanvas.tsx`](../../../apps/desktop/src/components/WaveformSegmentBandCanvas.tsx) | 改订阅「CM6→投影 store」（单向） |
| reveal/seek 策略 | [`selectionRevealSeekPolicy.ts`](../../../apps/desktop/src/utils/selectionRevealSeekPolicy.ts) | 保留；读 CM6 primary |
| 性能 profile | [`selectionLatencyProfile.ts`](../../../apps/desktop/src/services/ui/selectionLatencyProfile.ts) `__rushiSelectionProfile` | P0/回归门禁复用 |
| 段落持久化/结构变更 | [`useSegmentMutationController.ts`](../../../apps/desktop/src/pages/useSegmentMutationController.ts) · `segmentPublishApi.ts` | 由 CM6 transaction 适配层驱动 |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **B — CodeMirror 6 作为 Transcript Editor Core**：全文一份 `EditorState`（一行=一语段）；**选区 = CM6 selection + 一个 `StateField` 多选集合，成为唯一真源**（同时取代 SC1 与 SC2 可写角色）；语段元数据存 `StateField<SegmentMeta[]>`，随 transaction 映射；高亮（correctable/find）用 decoration；**meta 列优先与 CM6 同 DOM 视口锁步**（P0 按 gutter/line marker → block widget → React side-rail fallback 顺序验证）；波形/滚动订阅「CM6→单向投影 store」；持久化格式仍是 `SegmentDto[]`，但它只是序列化/保存投影，**会话内所有编辑、结构变更、选区变更必须通过 CM6 transaction 写入**。 |
| **不做什么** | ① 不选 ProseMirror/Lexical（无内建虚拟化 / 生态不匹配，§2.1）；② 不引入第二套可写选区真源、**不再有 reconcile / leadingSc1 / startTransition 选区编排**；③ 不改波形峰值/播放引擎、不改持久化 schema、不做协作/CRDT；④ 不保留每行 `<textarea>` + `epoch 重挂` + `useSegmentDraftStore` + `focusTranscriptSegmentTextarea` 重试（由 CM6 内核取代）。 |
| **与 ADR / architecture 关系** | **取代** `selection-chrome-bus` 决策的双真源部分（见顶部取代关系）；`desktop-waveform-engine.md` §点选契约与 SC1/SC2 二维将改写为「CM6 单真源 + 单向波形投影」；Transport Authority（seek 跟随逻辑选中）**保持**，只是「逻辑选中」= CM6 selection。 |
| **风险与 spike** | **P0 为硬门禁**（见 §4.1）：CM6 承载真实复杂行 + 大列表可行性与性能；历史 segment text 换行审计。Windows WebView2 + CJK IME **不阻塞本机 P0**（无 Windows 环境，显式跳过，见 §7.2），但为 **Windows 发版前硬门禁**。若 P0 其余项不达标 → **回退到路线 A**。 |

### 4.1 P0 可行性 spike（阻塞后续，必须先做）

| 验证项 | 达标线 | 不达标的处置 |
|--------|--------|--------------|
| CM6 doc + line decoration 选区 + **gutter/line marker 元信息列**（时间戳/badge/拖拽把手/右键菜单入口/find 高亮/长文本换行/字号变化/可变行高）**同 DOM 视口锁步** | 在真实滚动容器与现 CSS 约束下视觉与现列表等价，无错位/抖动 | gutter/line marker 不可行 → 试 CM6 block widget；仍不行 → React side-rail + rAF DOM scroll 同步；仍不行 → 回退路线 A |
| 2000 段选区切换延迟（`__rushiSelectionProfile`） | P95 ≤ 现状 `listCommit`（≈400ms）且主观 <50ms | 超标 → 回退路线 A |
| 2000 段滚动 FPS | 无明显掉帧 | 超标 → 回退路线 A |
| **Windows WebView2 + CJK IME** | 在 Tauri/WebView2 中分别测试搜狗拼音、微软拼音：首字不丢、全角标点一次提交、composition 不被外部 transaction/seek 打断、候选框不漂移；必须分别记录 `EditContext` on/off，重点验证 `EditorView.EDIT_CONTEXT = false` | **P0 显式跳过**（无 Windows 环境，2026-07-10 用户决定）。残留风险：Windows 发版前必须补测；编码默认 `EditorView.EDIT_CONTEXT = false`；若日后 Windows 补测失败 → 回退路线 A 或保留 textarea 输入路径 |
| 历史段文本换行审计 | 明确给出「无换行 / 可逆编码 / 显式拒绝 / 数据迁移」之一，禁止 `replace(/\\n/g,\" \")` 静默破坏 | 无可接受策略 → 回退路线 A |

**产出**：spike 报告追加到本文 §7；据结论确认「进入编码 / 回退 A」，用户签字。

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| **依赖** | `@codemirror/state` `@codemirror/view`（+ 必要 commands/history） | 新增 |
| **编辑器内核** | `apps/desktop/src/components/editor/core/*`（新目录：EditorState 构建、SegmentMeta StateField、selection 命令、decoration、doc↔segments 映射、transaction→dirty/autosave/undo 桥） | 新增 |
| **投影 store** | `services/selection/*` | 大改：`selectionChromeStore` 降为「CM6→单向投影」；删 `reconcile*` / `leadingSc1` / `publishSelectionChrome` 抢跑 / `applySelectionChromeImperative`(行部分) |
| **SC1** | `useProjectEditorState.selectedIdx` · `useSegmentSelectionController` · `useSelectedIdxCommitter` · `useWaveformKeyboardSelectionCommit` · `useListKeyboardBurstSelection` · `runSelectSegmentAt` | 删除/折叠入 CM6 |
| **文本行栈** | `SegmentRowTextField` · `useSegmentRowTextField*` · `useSegmentDraftStore` · `flushSegmentTextDrafts` · `focusTranscriptSegmentTextarea` · `transcriptSelection` | 删除/由 CM6 取代 |
| **虚拟列表 / meta 列** | `EditorSegmentListViewport` · `segmentListVirtualWindow*` · `useEditorSegmentListScroll` · `listKeyboardBurstCoordinator` | 删除/改为 CM6 视口内 gutter/line marker 或 widget；React side-rail 仅 fallback |
| **波形** | `WaveformSegmentBandCanvas` · `useWaveformSelectionChromeView` · overlay 控制器 | 改：订阅投影 store |
| **控制器** | `useSegmentMutationController`（split/merge/delete）· `useFindReplaceController` · `useCorrectionRulesController` · 快捷键 dispatcher · 右键菜单 | 改：作用于 CM6 model |
| **架构文档** | `desktop-waveform-engine.md` · 旧 `selection-chrome-bus-research.md`（标注被取代） | 改 |
| **测试** | selection/编辑相关 ~40 文件 | 大改：改写为「CM6 单真源」断言 |

> **coexistence**：全程用 feature flag `transcriptEditorCore` 并存新旧编辑器，逐特性迁移、每阶段绿；达标后翻旗并删旧栈（详见 plan）。

---

## 6. 签收

- [x] 调研 brief 完成
- [x] P0 spike 报告追加（§7）并确认「进入编码 / 回退 A」→ **进入编码（P1）**（2026-07-10）
- [x] plan / acceptance 已链接本文
- [x] 用户确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-10 | 初版：CM6 vs ProseMirror(无虚拟化) 对照，选定 CM6 单真源，取代 SC1/SC2 双真源决策，P0 硬门禁 |
| 2026-07-10 | 开始 P0：落地 `__spike__` + 依赖；§7 填入 jsdom 实测；IME/生产审计仍阻塞 |
| 2026-07-10 | 用户决定跳过 Windows WebView2+CJK IME（无 Windows）；改为发版前硬门禁 |
| 2026-07-10 | 换行策略定稿（U+240A）；Chromium 2000 段滚动 fps=62、gutterΔ=0；本机 P0 达标，待签字进 P1 |
| 2026-07-10 | 用户签字进入 P1；落地 `components/editor/core/` 骨架 + flag（默认 off） |
| 2026-07-10 | P2：selection field/commands/decorations + transcriptProjection 单向投影 |

---

## 7. P0 spike 报告（本机门禁可关闭 — 待用户签字进入 P1）

> **禁止填写未实测或推测性数据。** Windows IME 为显式跳过，不是「已通过」。

### 7.1 已落地的 spike 代码

| 路径 | 作用 |
|------|------|
| `apps/desktop/src/components/editor/core/__spike__/` | CM6 doc + meta StateField + line decoration 选区 + gutter/lineMarker；默认可逆 `\u240A` 编码 |
| `apps/desktop/spike-transcript-editor.html` + `src/spike-pages/transcriptEditorCoreSpikeMain.ts` | 浏览器滚动/gutter 压测页 |
| `apps/desktop/src/perf/transcriptEditorCoreSpike.perf.ts` | 2000 段选区 dispatch（jsdom） |
| `apps/desktop/tests/e2e/desktop-spike-cm6-scroll.spec.ts` | Chromium 滚动 FPS + gutter 锁步 |
| `scripts/audit-segment-newlines.mjs` | 对导出的 `segments.json` / file-detail 做换行审计 |

依赖：`@codemirror/state@6.7.1` · `@codemirror/view@6.43.6`（已加入 `@rushi/desktop`）。

### 7.2 实测结果

| 验证项 | 结果 | 证据 |
|--------|------|------|
| round-trip / 换行策略 | **通过** | 默认 `encodeEmbeddedNewlines`：嵌入 `\n` → U+240A；serialize 还原。单元 7 tests 绿。禁止静默空格替换。 |
| gutter 挂载 + 选区 decoration | **通过** | jsdom 单元 + Chromium e2e |
| 2000 段选区 dispatch P95 | **通过（jsdom）** | `p50≈1.3ms p95≈2.1ms max≈5.2ms` |
| 2000 段滚动 FPS + gutter 锁步 | **通过（macOS Chromium / Playwright）** | `[spike-scroll-bench] fps=62, gutterMaxAbsDeltaPx=0, gutterPass=true, selectionP95Ms≈2.3ms`（命令：`PW_DESKTOP_WEBSERVER=1 npx playwright test --project=desktop-ui tests/e2e/desktop-spike-cm6-scroll.spec.ts`） |
| block widget / React side-rail | **不需要（本轮）** | gutter/lineMarker 已达标；保留为 fallback，不进默认路径 |
| Windows WebView2 + CJK IME | **P0 显式跳过** | 无 Windows。**Windows 发版前硬门禁**；编码默认 `EDIT_CONTEXT=false` |
| 生产库换行 hitRate | **未跑真实库** | 策略已定稿为可逆 `\u240A`；有导出时用 `audit-segment-newlines.mjs` 复核，不阻塞本机 P0 |

### 7.3 换行策略定稿

**采用可逆编码**：段内 `\n`/`\r\n`/`\r` → U+240A（SYMBOL FOR LINE FEED）；CM6 一行一段；序列化时还原为 `\n`。  
**禁止** `replace(/\n/g, " ")`。生产导出复核为加分项，非本机 P0 阻塞。

### 7.4 门禁结论

| 项 | 状态 |
|----|------|
| 本机 P0（CM6 骨架 / gutter / 2000 段延迟与滚动） | **达标** |
| Windows IME | **跳过 → 发版前补测** |
| 进入 P1 业务编码 | **已签字（2026-07-10 用户确认）** |

### 7.5 复现命令

```bash
npm run test -w @rushi/desktop -- src/components/editor/core/__spike__
npm run test:perf -w @rushi/desktop -- src/perf/transcriptEditorCoreSpike.perf.ts
cd apps/desktop && PW_DESKTOP_WEBSERVER=1 npx playwright test --project=desktop-ui tests/e2e/desktop-spike-cm6-scroll.spec.ts
# 手测页：vite 起后打开 http://127.0.0.1:1421/spike-transcript-editor.html
```

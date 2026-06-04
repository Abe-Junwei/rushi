# F6 / F6+ / 纳入记忆 — 手测清单

> **状态**：✅ 手测签收（2026-06-02）· **⑤″f-B** 子项 — [`r3-5f-b-hand-test-checklist.md`](./r3-5f-b-hand-test-checklist.md)  
> **验收真源**：[`r3-asr-voc-landing-acceptance.md`](./r3-asr-voc-landing-acceptance.md) § ASR-VOC-2（2a / 2a+）· [`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) P1 F6  
> **纳入记忆入口（2026-06）**：语段正文 **选区 + 右键「纳入更正记忆…」** → `ManualCorrectionMemoryDialog` → `correction_memory_save`（**不再**在保存语段时自动推断 learnEdit / explicit_pairs）。  
> **机器回归**：`manualCorrectionMemory.test.ts` · `correctionLearnBaseline.test.ts` · `segmentTextContextMenuModel`（`jixingLearnSpan.test.ts` 等自动追踪用例已移除）

## 环境

- [x] `npm run desktop:dev`；已打开含正文的转写项目
- [x] 欢迎页 → **热词与记忆**：术语库可打开；纠错记忆表可见
- [x] 机器闸门（签收前）：

```bash
npm run typecheck && npm run test -w @rushi/desktop && node scripts/check-architecture-guard.mjs
```

**代码核对（2026-06-03）**：上述三条命令已通过；§A 接线见 `segmentTextContextMenuModel.ts` → `ProjectPanel` → `useManualCorrectionMemoryDialog`（纳入成功后调用 `checkGlossaryLearnAfterSave`）；语段侧 **无** `SegmentPendingLearnStrip` / `SegmentLearnConfirmDialog` 挂载。

---

## §A — 手动纳入更正记忆（F6+ 主路径）

**操作**

1. 在语段正文中 **拖选** 错词（例：`激行`），须为非空选区。
2. **右键** → **纳入更正记忆…**（无选区或 `busy` 时该项应禁用）。
3. 对话框 **纳入更正记忆**：错形只读为选中文本；在 **正确形式** 输入 `经行`。
4. 勾选 **同时加入转写词汇表** → **纳入记忆**。

**期望**

- [x] Toast：`已纳入纠错记忆：「激行」→「经行」`
- [x] 纠错记忆表：`before=激行`、`after=经行`（去标点后与校验一致）
- [x] 术语库：`term=经行`，**hotword_enabled=1**；转写确认框 preview 含该 term
- [x] **未**把错形 `激` / `激行` 写入 term 或 hotwords（Q-ACC-8）
- [x] 保存语段 / ⌘·Ctrl+Enter **不会**再弹出旧的「纳入纠错记忆？」确认框（`SegmentLearnConfirmDialog` 未挂载）

**回归**

5. 再测一组：`内晋` 选区 → 右键纳入 → 正形 `内劲`；表中应为 **`内晋` → `内劲`**（整词，非单字对）。

---

## §B — F6 第 3 次纳入后进表提示（hit≥3）

> 命中次数由 **`correction_memory_save`**（§A 每次确认）累加；第 3 次纳入成功后 **`checkGlossaryLearnAfterSave`** 与语段保存后同源拉取（`hit_count ≥ 3` 且术语库尚无该 term）。

**准备**：术语库中 **尚无** term=`制控`（或换一组未入库的正形）。

**操作**

1. 在 **不同语段**（或同段）三次：选 `智控` → 右键纳入 → 正形 `制控` → 确认（可不勾词汇表）。
2. 第 1、2 次纳入后：**不应**出现 GlossaryLearnPrompt。
3. 第 3 次纳入确认后：**无需**再保存语段，应出现 **GlossaryLearnPrompt**，文案含命中次数。
4. 点 **加入词汇表** → `term=制控`，`hotword_enabled=1`。

**期望**

- [x] 第 1、2 次纳入后无 F6 进表提示
- [x] 第 3 次纳入后即有提示，且 `term` 为正形 `制控`，**非** `智控`
- [x] 已存在 term 时 toast「已在词汇表中」、不重复 INSERT

---

## §C — 术语库「挖掘推荐」（GlossaryMine · hit≥2）

**操作**

1. 纠错记忆中已有 `hit≥2` 或 `accepted_as_rule`，且术语库无同 term 的 `after_text`。
2. 打开 **热词与记忆** → **挖掘推荐** 区应列出候选（含 sample_before / 命中次数）。
3. **加入词汇表** / **忽略** 各试一条。

**期望**

- [ ] 加入后术语库刷新；忽略后该 after_text 不再提示（localStorage dismiss）

---

## §D — REV-LOC 切片 A（与 F6 同轮可测）

> 专用清单：[`rev-loc-slice-a-hand-test-checklist.md`](./rev-loc-slice-a-hand-test-checklist.md)

1. §1–§3：见 [`rev-loc-slice-a-hand-test-checklist.md`](./rev-loc-slice-a-hand-test-checklist.md)（2026-06-03 ✅）

---

## §E — 负例（手动纳入对话框应拒绝或不可学）

在 §A 对话框点 **纳入记忆** 时，应由 `validateManualCorrectionMemoryPair` 拦截（错误信息展示在面板/全局 error 区）：

| 场景 | 操作 | 期望 |
|------|------|------|
| 无选区 | 不选中即右键 | 菜单项禁用或无可点「纳入更正记忆…」 |
| 单字 CJK | 只选 `其`，正形 `七` | 提示不符合纳入规则（单字替换） |
| 仅标点差异 | 选 `，` 改 `。` | 仅标点或空白无法纳入 |
| 错正相同 | 正形与选中文本相同 | 提示相同，不入库 |
| 仅改稿未纳入 | 编辑语段但不走 §A | **无** 自动弹学词框；⌘/Ctrl+Enter 仅保存草稿并跳下一条（有未保存修改时） |

---

## 已弃用（手测勿按旧路径签收）

| 旧行为 | 现状 |
|--------|------|
| IME 改词后 Enter / 语段「确认」弹「纳入纠错记忆？」 | 已移除；改 §A 右键 |
| 保存语段时 `learnBaseline` + `explicit_pairs` 自动学词 | Rust `file_save_segments` 忽略 `_count_hits` / baseline；仅 **查找替换 Replace All** 等仍传 `explicitPairs` |
| 语段右侧 pending learn 条 / 确认纳入按钮 | `segmentLearnButtonVisible` 恒 false |

---

## 签收记录

| 日期 | §A 手动纳入 | §B hit≥3 | §C Mine | §D REV-LOC A | 备注 |
|------|-------------|----------|---------|--------------|------|
| 2026-06-02 | ✅ | ✅ | — | ✅ REV-LOC A | §C Mine 可另轮 |

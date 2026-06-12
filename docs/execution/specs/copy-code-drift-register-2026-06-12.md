# 文案—代码漂移登记表

> **审查计划**：[`code-review-program-2026-06.md`](./code-review-program-2026-06.md) Phase 7  
> **状态**：Phase 7 静态完成 · 动态 release 手测待补  
> **基线单测**：1310/1310 ✅（含 invoke ACL 守卫）

## 状态图例

| 状态 | 含义 |
|------|------|
| 🔴 待修 | 已确认漂移，需改代码或真源 |
| 🟡 待决 | 需产品/文案拍板或 release 手测 |
| 🟢 已修 | 本轮已闭合 |
| ⚪ N/A | 有意不分真源或文档层 |

---

## 登记

| CX | ID | 文案位置 | 声称 | 代码/动态实际 | 真源 | 状态 |
|----|-----|----------|------|---------------|------|------|
| CX2 | C-11 | 波形右键「在指针时间拆分」hint | ⌘D | 菜单 `pointerTimeSec`；⌘D=播放头 | 无全局快捷键 | 🟢 |
| CX3 | C-01 | `DeleteSegmentConfirmDialog` | 硬编码 ⌘Z | `edit.undo` | `editorShortcutMenuHint` | 🟢 |
| CX3 | C-01 | `EditorSegmentToolbarActions` | 硬编码 ⌘F | `workflow.find` | registry | 🟢 |
| **CX0** | C-03 | `asrOneClickPrepareModelFlow.ts:87` | release 一键准备失败 | 追加 `npm run asr:dev` | `packagedOrDev` | 🟢 |
| **CX0** | C-03 | `LocalAsrAdvancedSection` stub help | 高级诊断 | `<pre>` 含 dev pip/npm | 仅 dev 展示 | 🟢 |
| **CX1** | C-09 | `prepareModelDownloadCopy` modelscope | venv/pip | release 应一键准备 | `isPackagedDesktopApp` | 🟢 |
| CX3 | C-01 | `FindReplaceDialog` | ⌘Enter 替换当前 | 对话框局部 | **产品：保持局部** | ⚪ |
| CX3 | C-01 | `WaveformSegmentOverlay` title | 多键说明 | 选区交互 | **产品：保持局部** | ⚪ |
| CX3 | C-04 | `asrEnvStatus.ts:305` | 错误横幅泛化 | vs 可操作 `blockReason` | 统一措辞 | 🟢 |
| CX3 | C-03 | `EnvQualityPanel` | `npm run eval:run` | 质量 Tab 说明 | `packagedOrDev` | 🟢 |
| CX3 | C-07 | `transcribePreviewState` | async 回退 hint | `usedAsyncFallback` toast | job controller | 🟢 |
| CX3 | C-13 | `user-guide-zh.md` | 无快捷键 | 仅设置内表格 | L4 摘要 | 🟢 |
| CX3 | C-11 | 右键「标记定稿」hint | ⌘Enter | `markSegmentFinalized` | 接近定稿 | ⚪ |
| CX4 | C-08 | preflight vs 在线 STT panel | 措辞略异 | 同一 blockReason 链 | 可接受 | ⚪ |
| CX4 | C-03 | `sidecarNotListening*` exports | 未消费 | 已删 dead export | — | 🟢 |
| — | C-01 | `GlossaryBulkAddDialog` | ⌘↵ 提交 | 表单局部 | OK | ⚪ |
| — | C-01 | `editorFooterShortcutHints.legacy` | ↑↓ / 停笔 | registry「其它」 | 双真源 | ⚪ |

---

## C-01–C-15 静态核对

| ID | 静态 | 动态 | 备注 |
|----|------|------|------|
| C-01 | ✅ | 🟡 D1–D8 | registry + 3 处修复 |
| C-02 | ✅ | 🟡 D6 | Esc stack 单测 46+ |
| C-03 | ✅ | 🟡 S1 | CX0 已修 |
| C-04 | ✅ | 🟡 S2–S3 | D1–D6 对齐 |
| C-05 | ✅ | 🟡 D1–D2 | 无 Key ≠ 网络错误 |
| C-06 | ✅ | 🟡 | transcribe source 一致 |
| C-07 | ✅ | 🟡 S6 | 12k 在 asrTranscribeHints |
| C-08 | ✅ | 🟡 | coordinator = 设置 banner |
| C-09 | ✅ | 🟡 | D4 进度；CX1 已修 |
| C-10 | ✅ | 🟡 D4 | Gate-B No-Go 遵守 |
| C-11 | ✅ | 🟡 D4 | 指针拆分 hint 已修 |
| C-12 | ✅ | N/A | Env section 一致 |
| C-13 | ✅ | N/A | user-guide §5 已补 |
| C-14 | ✅ | N/A | toast 中文在 TS |
| C-15 | ✅ | N/A | CONTEXT 抽样无冲突 |

---

## 7-A–7-E 子轮

| 子轮 | 静态 | 动态 |
|------|------|------|
| 7-A 快捷键 | ✅ | ☐ release D1–D8 |
| 7-B ASR 能力 | ✅ | ☐ S1–S6 |
| 7-C STT/LLM | ✅ | ☐ D1–D5 |
| 7-D 导出/质量 | ✅ | ☐ EXP-WORD / eval 抽检 |
| 7-E 文档 | ✅ | N/A |

---

## 修订

| 日期 | 说明 |
|------|------|
| 2026-06-12 | 启动 7-A；指针拆分 / 删除确认 / 查找 hint |
| 2026-06-12 | 全计划执行：CX0/CX1 修复；user-guide §5；登记表扩至 C-15 |
| 2026-06-12 | Sprint C 闭合：asrEnvStatus / EnvQualityPanel / async fallback toast；R-18 删 sidecarNotListening |
| 2026-06-12 | Sprint B2：补 `allow-asr-supervisor-snapshot`；`checkTauriInvokeAcl` + 单测 |

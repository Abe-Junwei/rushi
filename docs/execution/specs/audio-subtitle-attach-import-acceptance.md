# Acceptance：音频 + 字幕 Attach import（Replace）

> **Research**：[audio-subtitle-attach-import-research.md](./audio-subtitle-attach-import-research.md)  
> **Plan**：[audio-subtitle-attach-import-plan.md](./audio-subtitle-attach-import-plan.md)  
> **Architecture**：[`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md) · [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)（视图维 V1–V5）

---

## 总闸门

- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run lint`（无 error）
- [x] `node scripts/check-architecture-guard.mjs`（无新增 error）
- [x] `cargo test --lib`（含 import_transcript / import_duplicate replace bypass）
- [x] `cargo clippy --all-targets -- -D warnings`（见下方验证记录）

---

## 能力—UI 状态矩阵

维度见 research §6（**V1** Editor 态 · **V2** 目标有 audio · **V3** 转写 busy · **V4** dirty · **V5** stem 候选数）。

| UI / 动作 | 条件 | 预期 |
|-----------|------|------|
| Editor「导入字幕…」 | V3 | disabled；toast「转写进行中…」 |
| Editor「导入字幕…」 | V4 | UnsavedCloseDialog → 放弃/保存后继续；Replace 后仍同一 File |
| Editor「导入字幕…」 | V1 ∧ ¬V3 ∧ ¬V4 | 当前 File 语段被替换；**波形仍显示**（V2） |
| Hub「导入转录文本」 | V5 = 0 | 新建 `text` File；无波形 |
| Hub「导入转录文本」 | V5 = 1 | Attach 匹配 File；Replace；打开该 File |
| Hub「导入转录文本」 | V5 ≥ 2 | 选目标对话框 → Replace → 打开所选 File |
| DuplicateImportConfirmDialog | Editor 同 File 再导同一 SRT | **不出现** |
| DuplicateImportConfirmDialog | Hub 导入与**其他** File 内容相同 | 仍可出现（打开已有 / 仍导入副本） |
| 文件列表类型标签 | Attach 后 | 目标 File 为「音视频」(`paired`)，**无**额外同名 `text` 行 |
| `fallbackWaveFile` 按钮 | Attach 主路径成功后 | 用户**不应**需要点击「切换到可显示波形的文件」 |

### 矛盾场景手测（≥2）

1. **先音频后 SRT（主路径）**：空项目 → 导入 `采访.wav` → Editor → 导入 `采访.srt` → 同屏波形 + 语段；文件列表仅一条「采访」为 paired（或 audio 升 paired）。
2. **Hub 双音频同 stem**：项目内 `采访A.wav`、`采访B.wav`（或同名 stem）→ Hub 导入 `采访.srt` → 必须弹选 File → 仅所选 File 语段更新。

---

## 自动验收

| 区域 | 测试（计划路径） |
|------|------------------|
| Replace 保留 audio | `file_import_cmd.rs` rust tests |
| stem 解析 | rust + `importFileDisplayName` / `countStemAttachCandidates` |
| Editor bypass dedupe | `useProjectImportDuplicateController.test.ts` |
| Hub dedupe stem 0 | `useProjectImportDuplicateController.test.ts` |
| Replace target dedupe bypass | `import_duplicate/tests.rs` |
| import 后 openFile | `useProjectCloseGateController.test.ts` |
| legacy fallbackWaveFile | `legacyWaveformFallback.test.ts` |
| Attach 保留 audio provenance | `file_import_cmd.rs` |
| Hub need_target dialog flow | `projectAttachTranscriptImport.test.ts` |
| importFileDisplayName trim | `projectImportDuplicate.test.ts` |
| Close Gate 链 | 现有 close gate tests 不回归 |

---

## 手测清单

### ASI-A Editor Attach（P0）

- [ ] 新建项目 → 导入音频 → 进入 Editor（有波形、无语段）
- [ ] 导入与音频同 stem 的 `.srt` → 语段出现；波形仍在；时间轴与 SRT 时间一致
- [ ] 修改语段未保存 → 再导入 SRT → Close Gate → 放弃 → 语段以 SRT 为准
- [ ] 转写进行中 → 「导入字幕」不可用 + toast
- [ ] 同一 SRT 再导入一次 → 直接替换；**无**重复导入对话框

### ASI-B Hub Sidecar（P0）

- [ ] 项目仅一条 `会议.wav` → Hub 导入 `会议.srt` → 打开该 File；波形+语段
- [ ] 项目无匹配音频 → Hub 导入 `其他.srt` → 新建 text File；无波形
- [ ] 两条可匹配音频 → Hub 导入 → 选 File 对话框 → 仅所选 File 更新

### ASI-C 回归

- [ ] 欢迎页「从文本创建项目」仍正常（纯 text）
- [ ] 重复导入**不同** File 仍弹 DuplicateImportConfirmDialog
- [ ] Close Gate / 换文件 / 关项目 不回归

---

## 非目标（本薄片不做）

- VTT、ASS 导入
- 语段合并导入
- 自动对齐 / forced align（另薄片）
- orphan text+audio 历史数据批量合并工具

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 初版 acceptance（grill 决策落地） |
| 2026-06-20 | 自动闸门勾选；fallbackWaveFile 收缩为 legacy text-only；Rust replace_target dedupe bypass |

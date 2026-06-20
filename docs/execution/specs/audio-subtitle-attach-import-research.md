# 调研：音频 + 字幕 Attach import（Replace）

> **状态**：已采纳（grill 2026-06-20）  
> **关联路线图**：文件容器补完 · [`file-container-refactor.md`](./file-container-refactor.md) Slice 6 未完成项  
> **关联架构**：[`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md) · [`CONTEXT.md`](../../../CONTEXT.md)（Attach import / Sidecar stem match）  
> **关联 spec**：[`audio-subtitle-attach-import-intent.md`](./audio-subtitle-attach-import-intent.md) · [`…-plan.md`](./audio-subtitle-attach-import-plan.md) · [`…-acceptance.md`](./audio-subtitle-attach-import-acceptance.md)  
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 项目内已导入音频并在 **Editor** 编辑；用户从外部拿到 `.srt`（或 `.txt`），希望在**同一条 File** 上看到波形 + 对齐语段，而非两条分裂记录。 |
| **本仓现状** | `import_text_to_project` 永远 `INSERT file_type=text`（[`project_create_cmd.rs`](../../../apps/desktop/src-tauri/src/project/project_create_cmd.rs)）；`loadProjectAfterImport` 打开 `updated_at_ms` 最新 File；Editor 对纯 `text` 显示「无音频轨道」并用 `fallbackWaveFile` 引导切换——**配对真源缺失**。 |
| **成功标准** | Editor 导入 → 当前 File **Replace import** 语段且保留 `audio_path`；Hub 导入 → **Sidecar stem match** 唯一命中或用户选目标；转写 busy 禁用；dirty 走 Close Gate；同目标 re-import 不走重复导入对话框。 |

---

## 2. 业内成熟路线（≥3）

| # | 路线 | 代表 | 核心机制 | 可验证链接 |
|---|------|------|----------|------------|
| A | **Sidecar 同名配对** | Subtitle Edit、ffmpeg、Jellyfin | `media.ext` + 同 stem `.srt`；导入挂到主媒体 | [Subtitle Edit — Import subtitles](https://www.nikse.dk/subtitleedit/help) |
| B | **单文档 / composition** | Descript、MacWhisper、Otter | 一个 composition = 媒体 + 稿；再导入 = **更新当前稿** | 产品内 Import transcript（无公开 schema） |
| C | **NLE  caption 轨** | Premiere、DaVinci Resolve | SRT 作为 caption **轨**挂到**当前序列**；多 clip 时用户选目标 | Adobe Help — Import captions |
| D | **语料工具** | ELAN、Praat | 单一 media 真源 + annotation tier；不存平行「无 media 条目」 | [ELAN structure](https://archive.mpi.nl/tla/elan) |

**对照结论**：Rushi 已有 `files` + `segments.file_id` 容器，最接近 **A + B 混合**——Hub 用 sidecar stem；Editor 用「当前 File = composition」（grill 拍板 **Attach + Replace**）。**不**引入 NLE 多轨 schema（路线 C 仅借交互：歧义时选目标 File）。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 |
|------|--------|----------|-------------------|
| A Sidecar | **高** | `import_file_display_name` stem、现有 `paired`/`audio_only` | 多音频须歧义 UI（A1） |
| B 单文档 | **高** | `currentFileId`、`load_file`、`file_save_segments`、Close Gate | 须改 import 命令，非仅 UI |
| C NLE | 低 | 「选目标 clip」对话框模式 | 不做 timeline/track 表 |
| 本仓 dedupe | **高** | `import_duplicate` fingerprint；**Attach 同目标 re-import 须 bypass** | 现 duplicate 文案假设「新建副本」 |

**本仓已有、须扩展而非 fork**

- `import_parse.rs` — SRT/TXT 解析
- `project_create_cmd.rs` — 改为 `import_transcript_to_file_inner` + 项目级 target 解析
- `useProjectImportDuplicateController.ts` — 传 `targetFileId` / Hub 选 File
- `closeGateProjectLoad.loadProjectAfterImport` — 按 attach 结果 `openFile`，非 sort 最新
- `DuplicateImportConfirmDialog` — 仅跨 File 重复；同 File Replace 跳过

---

## 4. 决策摘要（grill 2026-06-20）

| 问题 | 结论 |
|------|------|
| **Editor 默认** | **Attach import** → `currentFileId` |
| **语段语义** | **Replace import**（整份替换；不清 audio） |
| **Hub 默认** | **Sidecar stem match** → 唯一 `paired`/`audio_only`；**0 匹配** → 新建 `text` |
| **2+ stem 匹配** | 弹窗选目标 File（A1） |
| **dirty** | **G1**：Close Gate（保存/放弃/取消）后再导入 |
| **转写 busy** | **T2**：导入 disabled + toast |
| **同 File re-import** | **R1**：不走 `DuplicateImportConfirmDialog` |
| **不做什么** | 合并导入；`file_pairs` 新表；`fallbackWaveFile` 作配对真源；VTT v1；Hub 禁止导入；转写中静默停转写 |
| **与 file-container spec** | 对齐草案 `import_file_srt` → 实现名为 `import_transcript_to_file`（可保留 alias） |
| **file_type** | Attach 后含 `audio_path` 且语段非空 → `paired`；纯语段 → `text`；仅音频无语段 → `audio_only`（与 spec 标签一致） |

---

## 5. 落位预告

| 层 | 模块 | 变更 |
|----|------|------|
| Rust | `project_create_cmd.rs` 或 `file_import_cmd.rs`（新） | `import_transcript_to_file_inner(file_id, src, Replace)`；项目 wrapper 解析 target |
| Rust | `import_duplicate/check.rs` | Attach 同 `file_id` 时 skip duplicate；跨 File 仍检测 |
| Rust | `import_parse.rs` | 复用；可选 v1.1 放宽 `\n\n` 分块 |
| TS | `fileApi.ts` | `importTranscriptToFile(projectId, fileId, srcPath)` + Hub wrapper |
| TS | `useProjectImportDuplicateController.ts` | Editor attach；Hub stem + 选 File 对话框 |
| TS | `closeGateProjectLoad.ts` | `loadProjectAfterImport` → open attached `fileId` |
| UI | `EditorToolbar.tsx` | 文案「导入字幕…」；转写 busy disabled |
| UI | `AttachImportTargetDialog.tsx`（新） | Hub 2+ 候选选 File |
| UI | `EditorView.tsx` | 移除对 `fallbackWaveFile` 的主路径依赖（attach 成功后同 File 有波形） |
| 测试 | Rust + Vitest | attach/replace/stem/duplicate bypass/close gate 契约 |
| 文档 | `desktop-project-file-lifecycle.md` | §重复导入 / §loadProjectAfterImport 增补 Attach 语义 |

---

## 6. 能力—UI 状态矩阵（预览）

| 维度 | 含义 |
|------|------|
| **V1** | 当前是否 Editor（`currentFileId` 非空） |
| **V2** | 目标 File 是否有 `audio_path` |
| **V3** | 转写 busy（`busyReason` transcribe / batch） |
| **V4** | 语段 dirty |
| **V5** | Hub stem 匹配候选数（0 / 1 / 2+） |

| UI / 动作 | 条件 | 预期 |
|-----------|------|------|
| 导入字幕 | V1 + V3 | disabled + toast |
| 导入字幕 | V1 + V4 | Close Gate → Replace → 仍 V1 |
| 导入字幕 | V1 + ¬V3 + ¬V4 | Attach 当前 File；波形+语段同屏 |
| 导入转录文本 | Hub V5=1 | Attach 匹配 File；Replace |
| 导入转录文本 | Hub V5=0 | 新建 `text` |
| 导入转录文本 | Hub V5≥2 | `AttachImportTargetDialog` |
| 重复导入对话框 | 同 File Replace | **不出现** |
| 重复导入对话框 | 不同 File、同 content | 仍出现（打开已有 / 仍导入副本——Hub 新建 text 路径） |

---

## 7. 签收

- [x] 调研 brief 完成（grill + 业内对照）
- [x] intent / plan / acceptance 已链接本文
- [x] 编码完成 · 自动验收 ✅ · 手测待勾选

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-20 | Attach 保留音频 import provenance；自动验收通过，手测待勾选 |

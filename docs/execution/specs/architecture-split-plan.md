# 架构拆分方案（盘点 + 设计）

> 日期：2026-06-04（刷新自 2026-05-21 初版）  
> 依据：架构守卫、`AI_QUICKSTART.md` 热点、[reviews/issues.md](../reviews/issues.md)、[file-container-refactor.md](./file-container-refactor.md)

## 1. 结论摘要

| 类别 | 数量 | 状态 |
|------|------|------|
| **>500 行 .rs / >400 行 TS 组件** | 0 | W3/W4 大文件已清零 |
| **接近阈值（≤300 行 / hook 数）** | 32 警告 | 见 §2；无错误 |
| **历史 P1（初版必须拆）** | 3 | 均已落地或显著缩小 |

功能类问题（R2/R1/R5）已修；本方案只谈 **可维护性 / 守卫 / 编排层纪律**，不新增产品行为。

**守卫趋势**：初版盘点 6 警告 → 拆分前峰值 ~40 警告 → **当前 32 警告**（2026-06-04）。

---

## 2. 当前守卫与阈值对照

```
架构守卫（2026-06-04）：0 错误，32 警告
```

验证命令：

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

### 2.1 仍触发警告（按优先级）

| 文件 | 行数 / Hook | 判定 |
|------|-------------|------|
| `ProjectPanel.tsx` | 436 行 / 13 hook | **建议拆**（组件 + hook 双超标） |
| `EditorSegmentToolbar.tsx` | 445 行 | **建议拆** |
| `useWaveformSegmentDrag.ts` | 397 行 | 接近阈值 |
| `DeliveryExportDialog.tsx` | 368 行 | 接近阈值 |
| `FindReplaceDialog.tsx` | 365 行 | 接近阈值 |
| `SegmentRowTextField.tsx` | 363 行 / 14 hook | hook 超标 |
| `useSegmentMutationController.ts` | 361 行 | 接近阈值 |
| `WaveformTimeRuler.tsx` | 349 行 / 13 hook | hook 超标 |
| `useLexiconProofreadController.ts` | 349 行 | 接近阈值 |
| `useWaveformPeaks.ts` | 347 行 | 接近阈值 |
| `useCorrectionMemoryController.ts` | 303 行 / **25 hook** | hook 严重超标 |
| `useProjectLifecycleController.ts` | 329 行 | 接近阈值（已从 671 降下来） |
| `useEnvLlmConfigPanel.ts` | 334 行 | 接近阈值（W1 抽出后仍偏大） |
| `pxPerSec.ts` | 376 行 | 接近阈值 |
| `localAsrModelCatalog.ts` | 316 行 | 接近阈值 |
| `reqwest::blocking` ×4 | `asr_sidecar/*`、`postprocess_ollama/probe` | 登记观察，非行数债 |

### 2.2 已从守卫清单移除（W1–W4 ✅）

| 原热点 | 拆分前 | 现状 |
|--------|--------|------|
| `postprocess_cmd.rs` | 1082 | **46** 行壳 + 子模块 |
| `postprocessRuntimeContract.ts` | 519 | **79** 行 re-export 壳 |
| `EnvLlmConfigPanel.tsx` | 482 | **73** 行 + `useEnvLlmConfigPanel` |
| `useFindReplaceController.ts` | 521 | **247** 行 + search/mutations 子模块 |
| `useProjectLifecycleController.ts` | 671 | **328** 行 + save/editor-tools 控制器 |
| `lexicon_bundle.rs` | 1004 | **289** 行壳 + types/db/import |
| `export_docx.rs` | 639 | **315** 行 + body/build |
| `correction.rs` | 635 | **190** 行 + types/learn/store/hints |
| `GlossaryPage.tsx` | 550 | **84** 行 + section 组件 |
| `project_cmd.rs` | 953 | 已拆入 `project/*_cmd.rs`（S1 ✅） |
| `EditorView.tsx` | 762 | **236** 行（S3 ✅） |
| `export_cmd.rs` | 580 | **94** 行 re-export 壳 |

---

## 3. 已完成拆分记录（W1–W4）

### W1 — LLM / 后处理契约栈 ✅

| 新文件 | 职责 |
|--------|------|
| `services/postprocess/llmProviderCatalog.ts` | Provider 类型与目录 |
| `services/postprocess/llmRuntimeStorage.ts` | 持久化 / bridge |
| `services/postprocess/llmConnectionUi.ts` | 连接 UI 状态 |
| `hooks/useEnvLlmConfigPanel.ts` | Env LLM 面板逻辑 |
| `components/EnvLlmConnectionForm.tsx` | 连接表单 UI |
| `postprocess_config.rs` | Rust 配置解析 |
| `postprocess_api_key_cmd.rs` | API Key / probe 命令 |

### W2 — Lifecycle 保存 + 查找替换 ✅

| 新文件 | 职责 |
|--------|------|
| `pages/useProjectSaveController.ts` | 保存 / 自动保存 / edit-log 恢复 |
| `pages/useProjectEditorToolsController.ts` | 编辑器工具编排 |
| `pages/projectLifecycleEditorToolsReturn.ts` | lifecycle return 映射 |
| `pages/findReplaceTypes.ts` | 类型 |
| `pages/useFindReplaceSearch.ts` | 搜索 / 导航 |
| `pages/useFindReplaceMutations.ts` | 替换 one/all |

### W3 — Rust 后处理 + 词表 + 导出 + 纠错 ✅

**`postprocess_cmd.rs` 子模块**

| 文件 | 职责 |
|------|------|
| `postprocess_types.rs` | 请求/响应类型 |
| `postprocess_auto_punctuate_cmd.rs` | 自动标点 |
| `postprocess_refine_cmd.rs` | 段界整理 |
| `postprocess_lexicon_proofread_cmd.rs` | 词表校对 |
| `postprocess_cancel_cmd.rs` | 取消 |

**`lexicon_bundle.rs` 子模块**：`lexicon_bundle_types` / `_db` / `_import`

**`export_docx.rs` 子模块**：`export_docx_body` / `export_docx_build`

**`correction.rs` 子模块**：`correction_types` / `_learn` / `_store` / `_hints`

> Tauri 约束：`lib.rs` 中 LLM 与后处理 command 须指向 **定义所在子模块**（如 `postprocess_cmd::postprocess_api_key_cmd::llm_save_api_key`），不可仅靠 `pub use` re-export。

### W4 — GlossaryPage ✅

| 新文件 | 职责 |
|--------|------|
| `pages/useGlossaryPageController.ts` | 多 controller 编排 |
| `glossary/GlossaryHotwordsSummarySection.tsx` | 热词摘要 |
| `glossary/GlossaryLexiconBundleSection.tsx` | 词表包 |
| `glossary/GlossaryTermManagementSection.tsx` | 术语编辑 / 批量 / 表 |
| `glossary/GlossaryCorrectionMemorySection.tsx` | 纠错记忆区 |

### 历史阶段（初版 S1–S3，早于 W 系列）

- **S1** `project_cmd.rs` → `project/segment_cmd.rs`、`file_cmd.rs`、`project_*_cmd.rs` 等 ✅
- **S3** `EditorView.tsx` → `components/editor/*` + hooks ✅
- **S5 部分** `export_cmd.rs` → `project_bundle_cmd.rs` + re-export 壳 ✅

---

## 4. Rust：仍待观察 / 低优

### 4.1 `transcribe.rs`（291 行）

未超 500 行守卫，但 AI_QUICKSTART 仍标记为热点。若继续加在线 STT Provider：

- `transcribe_http.rs` — multipart + ASR HTTP
- `transcribe_native_online.rs` — OpenAI / AssemblyAI dispatch（或并入现有模块）

### 4.2 `reqwest::blocking`（4 处警告）

`asr_sidecar/probe.rs`、`asr_sidecar/source.rs`、`postprocess_ollama.rs`、`postprocess_probe.rs`。  
单独 PR：改 async 或明确 `spawn_blocking` 边界；与行数拆分正交。

---

## 5. 前端：下一批建议（W5+）

按 **守卫严重度 + 回归面** 排序：

| 优先级 | 目标 | 策略 |
|--------|------|------|
| P1 | `useCorrectionMemoryController.ts`（25 hook） | 拆 selection / batch / editor 为 service 或子 hook；Glossary 页已薄，可复用 section 边界 |
| P1 | `ProjectPanel.tsx`（436 行 / 13 hook） | 按 tab/区域切 section；编排留 `useProjectPanelController` |
| P2 | `EditorSegmentToolbar.tsx`（445 行） | 按工具组切子组件 |
| P2 | 波形簇：`useWaveformSegmentDrag`、`WaveformTimeRuler`、`useWaveformPeaks` | 仅在加功能时拆，避免薄 hook 平移 |
| P3 | `useProjectLifecycleController.ts`（329 行） | 可选再抽 transcribe 委托；目标 ≤280 行 |
| P3 | `useEnvLlmConfigPanel.ts`（334 行） | probe/save 分文件 |
| P3 | `pxPerSec.ts`（376 行） | 纯函数按 concern 拆 test 友好模块 |

### 5.1 初版未动、仍有效的建议

**`SegmentTextListRow.tsx`**（228 行 / 17 hook）— hook 超标，行数未超：

- `SegmentTimestampColumn.tsx` — 时间 + 拖拽 handle
- `SegmentTextarea.tsx` — focus/resize 局部状态

**`EnvOnlineSttPanel.tsx`** — 若仍 >300 行，按 Provider 区块切 2 组件。

---

## 6. 实施顺序（更新）

| 阶段 | 范围 | 状态 | 验证 |
|------|------|------|------|
| **S1** | Rust `project_cmd` → 6 模块 | ✅ | `cargo test` |
| **S2** | lifecycle 脏检查 / save 抽出 | ✅ 大部分（W2） | `useProjectController.test` |
| **S3** | `EditorView` 纵向拆 | ✅ | 手测编辑器主路径 |
| **W1–W4** | LLM / lifecycle / Rust 热点 / Glossary | ✅ | 见 §3 |
| **W5** | `useCorrectionMemoryController` hook 债 | 待做 | 守卫 hook 数 |
| **W6** | `ProjectPanel` + `EditorSegmentToolbar` | 待做 | 手测项目面板 |
| **W7** | `transcribe.rs` / blocking HTTP | 按需 | 转写 / probe 手测 |

**纪律**：Rust 与 UI 拆分 **不同 PR**；每片合并后跑 §8 门禁。

---

## 7. 守卫与文档更新

每阶段合并后：

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

同步更新：

- 本文 §2 守卫快照日期
- [reviews/issues.md](../reviews/issues.md) 架构债条目
- `AI_QUICKSTART.md` 热点列表（移除已拆文件）

---

## 8. 明确不纳入本轮

| 项 | 原因 |
|----|------|
| `china_stt_shell/*` | 按厂商隔离，单文件清晰 |
| `WelcomeSidebar.tsx`（327 行） | 仅接近阈值；UX 债单独 PR |
| 测试文件超 300 行（如 `pxPerSec.test.ts`） | 低优；随源文件拆时搬迁 |
| 协作 / 联机 schema | 未实现 |
| bundle v2 多文件清单 | 产品扩展，非拆分 |

---

## 9. 已确认决策（归档）

1. **`project_cmd.rs`** — 已删除 monolith，保留 `project/mod.rs` + `pub use *_cmd::*` ✅
2. **Editor 子目录** — 使用 `components/editor/` ✅
3. **Rust 拆分** — `#[path]` 子模块 + 薄壳 re-export；Tauri command 在子模块定义并在 `lib.rs` 全路径注册 ✅
4. **Lifecycle / Glossary** — 编排下沉 controller hook，页面/组件只做组装 ✅

---

## 10. 变更日志

| 日期 | 变更 |
|------|------|
| 2026-05-21 | 初版：S1–S5 盘点与 EditorView / project_cmd 设计 |
| 2026-06-04 | 刷新：W1–W4 完成记录；守卫 32 警告；W5+ 下一批；S1/S3/export_cmd 标完成 |

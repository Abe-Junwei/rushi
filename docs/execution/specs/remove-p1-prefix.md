# Spec: 移除项目文件命名中的 P1 前缀

## 目标
将源码中所有标识「Phase 1 / Tier 1」的 `P1`/`p1` 前缀从文件命名、模块路径、导出符号、Tauri 命令、CSS 类名中移除。P1 已成为桌面端核心功能，前缀失去区分意义，造成冗余噪音。

---

## 影响面统计

| 层级 | 文件/目录数 | 说明 |
|------|------------|------|
| **Rust 后端** | 1 目录 + 9 `.rs` 文件 | `src-tauri/src/p1/` 整目录 |
| **前端文件重命名** | ~42 个 | components / hooks / pages / utils / config / styles / tauri-api |
| **前端 import 更新** | ~109 处 | `from "./p1Xxx"`、`from "../xxx/p1Xxx"` |
| **导出符号重命名** | ~92 个 | `export const P1_XXX`、`export type P1Xxx`、`export function p1Xxx` |
| **Tauri 命令名** | ~13 个 | `invoke("p1_xxx")` ↔ Rust `#[tauri::command] fn p1_xxx` |
| **CSS 类名** | ~25 个 | `.p1-*` 样式类 |
| **Tailwind token** | 5 个 | `zen-p1-wf-*` 颜色键 |
| **Design token** | 6 个 | `COLORS.p1Waveform*` |
| **文档文件** | 2 个 | `docs/architecture/p1-*.md`、`docs/execution/p1-*.md` |
| **总波及文件** | ~86 个 | 去重后实际需修改的文件 |

> 注：P2（`p2GlossaryApi.ts`、`useGlossaryP2Controller.ts`）与 P3（`p3ExportDocxApi.ts`）不在本次范围，但方案兼容后续同类清理。

---

## 命名映射总表（按目录分组）

### 1. Rust 后端 `apps/desktop/src-tauri/src/`

| 现路径 | 目标路径 |
|--------|----------|
| `p1/` 目录 | `project/` 目录 |
| `p1/mod.rs` | `project/mod.rs` |
| `p1/types.rs` | `project/types.rs` |
| `p1/utils.rs` | `project/utils.rs` |
| `p1/project_cmd.rs` | `project/project_cmd.rs` |
| `p1/transcribe.rs` | `project/transcribe.rs` |
| `p1/run_transcribe_cmd.rs` | `project/run_transcribe_cmd.rs` |
| `p1/export_cmd.rs` | `project/export_cmd.rs` |
| `p1/correction.rs` | `project/correction.rs` |
| `p1/glossary_cmd.rs` | `project/glossary_cmd.rs` |
| `p1/install_cmd.rs` | `project/install_cmd.rs` |

**引用更新点：**
- `lib.rs`: `mod p1;` → `mod project;`，所有 `p1::setup_db`、`p1::p1_pick_audio_path` 等
- `export_docx.rs`: `use crate::p1::SegmentDto;` → `use crate::project::SegmentDto;`
- `db.rs`、`asr_sidecar.rs` 等若引用也需同步

**Tauri 命令函数名映射：**

| 现函数名 | 目标函数名 |
|----------|-----------|
| `p1_pick_audio_path` | `pick_audio_path` |
| `p1_project_create` | `project_create` |
| `p1_project_list` | `project_list` |
| `p1_project_load` | `project_load` |
| `p1_project_save_segments` | `project_save_segments` |
| `p1_project_run_transcribe` | `project_run_transcribe` |
| `p1_project_delete` | `project_delete` |
| `p1_export_text_file` | `export_text_file` |
| `p1_install_funasr_deps_interactive` | `install_funasr_deps_interactive` |
| `p1_retry_bundled_asr_sidecar` | `retry_bundled_asr_sidecar` |
| `p1_open_app_data_folder` | `open_app_data_folder` |

> `p2_glossary_list`、`p2_glossary_add`、`p2_glossary_delete` 保持不动（仍位于 `project/` 模块内但保留自身前缀）。

---

### 2. 前端 Tauri API `apps/desktop/src/tauri/`

| 现文件 | 目标文件 |
|--------|----------|
| `p1Api.ts` | `projectApi.ts` |

**导出函数映射：**

| 现函数名 | 目标函数名 |
|----------|-----------|
| `p1PickAudioPath` | `pickAudioPath` |
| `p1ProjectCreate` | `projectCreate` |
| `p1ProjectList` | `projectList` |
| `p1ProjectLoad` | `projectLoad` |
| `p1ProjectSaveSegments` | `projectSaveSegments` |
| `p1ProjectRunTranscribe` | `projectRunTranscribe` |
| `p1ProjectDelete` | `projectDelete` |
| `p1ExportTextFile` | `exportTextFile` |
| `p1InstallFunasrDepsInteractive` | `installFunasrDepsInteractive` |
| `p1RetryBundledAsrSidecar` | `retryBundledAsrSidecar` |
| `p1OpenAppDataFolder` | `openAppDataFolder` |

**类型重命名：**

| 现类型名 | 目标类型名 | 所在文件 |
|----------|-----------|----------|
| `P1OnlineTranscribeBridgePayload` | `OnlineTranscribeBridgePayload` | `services/stt/sttOnlineProviderContract/types.ts` |
| `P1OnlineNativeAdapterId` | `OnlineNativeAdapterId` | `services/stt/sttOnlineProviderContract/types.ts` |

> 这些类型改名后，`p2GlossaryApi.ts`、`p3ExportDocxApi.ts` 中的 import 也需同步。

---

### 3. 前端 Components `apps/desktop/src/components/`

| 现文件 | 目标文件 |
|--------|----------|
| `P1ConfirmCreateView.tsx` | `ConfirmCreateView.tsx` |
| `P1EditorToolbar.tsx` | `EditorToolbar.tsx` |
| `P1EditorView.tsx` | `EditorView.tsx` |
| `P1EnvHelpPanel.tsx` | `EnvHelpPanel.tsx` |
| `P1EnvLocalAsrPanel.tsx` | `EnvLocalAsrPanel.tsx` |
| `P1EnvOnlineSttPanel.tsx` | `EnvOnlineSttPanel.tsx` |
| `P1EnvironmentPanel.tsx` | `EnvironmentPanel.tsx` |
| `P1ProjectHeader.tsx` | `ProjectHeader.tsx` |
| `P1ProjectSidebar.tsx` | `ProjectSidebar.tsx` |
| `P1ResizeBottomHit.tsx` | `ResizeBottomHit.tsx` |
| `P1SegmentContextMenu.tsx` | `SegmentContextMenu.tsx` |
| `P1SegmentTimelineCard.tsx` | `SegmentTimelineCard.tsx` |
| `P1WaveformTimeRuler.tsx` | `WaveformTimeRuler.tsx` |
| `P1WaveformZoomBar.tsx` | `WaveformZoomBar.tsx` |
| `P1WelcomeView.tsx` | `WelcomeView.tsx` |
| `ProjectP1Panel.tsx` | `ProjectPanel.tsx` |
| `p1OnlineSttProviderList.css` | `onlineSttProviderList.css` |

**Props / 类型映射：**

| 现名 | 目标名 |
|------|--------|
| `P1ProjectHeaderProps` | `ProjectHeaderProps` |
| `P1EnvironmentPanelProps` | `EnvironmentPanelProps` |
| `P1SegmentTimelineCardProps` | `SegmentTimelineCardProps` |
| `P1WaveformTimeRulerProps` | `WaveformTimeRulerProps` |
| `P1WaveformZoomBarProps` | `WaveformZoomBarProps` |

---

### 4. 前端 Hooks `apps/desktop/src/hooks/`

| 现文件 | 目标文件 |
|--------|----------|
| `useP1SegmentKeyboard.ts` | `useSegmentKeyboard.ts` |
| `useP1TierScrollSync.ts` | `useTierScrollSync.ts` |
| `useP1WaveformDisplay.ts` | `useWaveformDisplay.ts` |
| `useP1WaveformZoom.ts` | `useWaveformZoom.ts` |

---

### 5. 前端 Pages `apps/desktop/src/pages/`

| 现文件 | 目标文件 |
|--------|----------|
| `p1SegmentListHelpers.ts` | `segmentListHelpers.ts` |
| `p1SegmentListHelpers.test.ts` | `segmentListHelpers.test.ts` |
| `useP1ExportController.ts` | `useExportController.ts` |
| `useP1TranscriptionLayer.ts` | `useTranscriptionLayer.ts` |
| `useP1TranscriptionLayer.test.ts` | `useTranscriptionLayer.test.ts` |
| `useProjectP1Controller.ts` | `useProjectController.ts` |
| `useProjectP1Controller.test.ts` | `useProjectController.test.ts` |

**导出类型映射：**

| 现名 | 目标名 |
|------|--------|
| `P1TranscriptionLayerApi` | `TranscriptionLayerApi` |
| `P1TranscriptionLayerInput` | `TranscriptionLayerInput` |
| `P1BusyReason` | `BusyReason` |
| `P1BusyPack` | `BusyPack` |
| `ProjectP1ControllerApi` | `ProjectControllerApi` |
| `P1ExportApi` | `ExportApi` |
| `P1ExportDeps` | `ExportDeps` |

---

### 6. 前端 Utils `apps/desktop/src/utils/`

| 现文件 | 目标文件 |
|--------|----------|
| `p1BoundsSignature.ts` | `boundsSignature.ts` |
| `p1PxPerSec.ts` | `pxPerSec.ts` |
| `p1PxPerSec.test.ts` | `pxPerSec.test.ts` |
| `p1SegmentChrome.ts` | `segmentChrome.ts` |
| `p1SegmentContextMenuModel.ts` | `segmentContextMenuModel.ts` |
| `p1SegmentContextMenuModel.test.ts` | `segmentContextMenuModel.test.ts` |
| `p1SegmentLayout.ts` | `segmentLayout.ts` |
| `p1WaveformPrefs.ts` | `waveformPrefs.ts` |
| `p1WaveformPrefs.test.ts` | `waveformPrefs.test.ts` |

**导出符号映射：**

| 现名 | 目标名 |
|------|--------|
| `P1_TIMELINE_PX_PER_SEC` | `TIMELINE_PX_PER_SEC` |
| `P1_PX_PER_SEC_MIN` | `PX_PER_SEC_MIN` |
| `P1_PX_PER_SEC_MAX` | `PX_PER_SEC_MAX` |
| `clampP1PxPerSec` | `clampPxPerSec` |
| `P1SegmentContextMenuKey` | `SegmentContextMenuKey` |
| `P1SegmentContextMenuItem` | `SegmentContextMenuItem` |
| `p1PointerTimeFromSegmentCard` | `pointerTimeFromSegmentCard` |
| `buildP1SegmentContextMenuItems` | `buildSegmentContextMenuItems` |
| `p1SegmentCardChrome` | `segmentCardChrome` |
| `P1_WAVEFORM_HEIGHT_MIN` | `WAVEFORM_HEIGHT_MIN` |
| `P1_WAVEFORM_HEIGHT_MAX` | `WAVEFORM_HEIGHT_MAX` |
| `P1_WAVEFORM_HEIGHT_DEFAULT` | `WAVEFORM_HEIGHT_DEFAULT` |
| `P1_TRANSCRIPT_FONT_MIN` | `TRANSCRIPT_FONT_MIN` |
| `P1_TRANSCRIPT_FONT_MAX` | `TRANSCRIPT_FONT_MAX` |
| `P1_TRANSCRIPT_FONT_DEFAULT` | `TRANSCRIPT_FONT_DEFAULT` |
| `clampP1TranscriptFontPx` | `clampTranscriptFontPx` |
| `readStoredP1WaveformPxPerSec` | `readStoredWaveformPxPerSec` |
| `writeStoredP1WaveformPxPerSec` | `writeStoredWaveformPxPerSec` |
| `P1_SEGMENT_LANE_ROW_PX` | `SEGMENT_LANE_ROW_PX` |
| `computeP1SegmentLaneRowPx` | `computeSegmentLaneRowPx` |
| `assignP1SegmentOverlapLanes` | `assignSegmentOverlapLanes` |
| `computeP1TimelineWidthPx` | `computeTimelineWidthPx` |

---

### 7. 前端 Config `apps/desktop/src/config/`

| 现文件 | 目标文件 |
|--------|----------|
| `p1ControlStyles.ts` | `controlStyles.ts` |
| `p1ControlStyles.test.ts` | `controlStyles.test.ts` |

**导出符号映射：**

| 现名 | 目标名 |
|------|--------|
| `P1_CLAY_BTN_PRIMARY` | `CLAY_BTN_PRIMARY` |
| `P1_CLAY_BTN_SECONDARY` | `CLAY_BTN_SECONDARY` |
| `P1_CLAY_BTN_ONLINE_STT` | `CLAY_BTN_ONLINE_STT` |
| `P1_CLAY_BTN_GHOST` | `CLAY_BTN_GHOST` |
| `P1_CLAY_TEXT_INPUT` | `CLAY_TEXT_INPUT` |
| `P1_CLAY_SELECT` | `CLAY_SELECT` |

**Design Token 映射（`tokens.ts`）：**

| 现名 | 目标名 |
|------|--------|
| `p1WaveformSurface` | `waveformSurface` |
| `p1WaveformWave` | `waveformWave` |
| `p1WaveformProgress` | `waveformProgress` |
| `p1WaveformCursor` | `waveformCursor` |
| `p1WaveformRegionLaneLow` | `waveformRegionLaneLow` |
| `p1WaveformRegionLaneIdle` | `waveformRegionLaneIdle` |

---

### 8. 前端 Styles `apps/desktop/src/styles/components/`

| 现文件 | 目标文件 |
|--------|----------|
| `p1-waveform.css` | `waveform.css` |
| `p1-workspace.css` | `workspace.css` |

**CSS 类名映射：**

| 现类名 | 目标类名 |
|--------|----------|
| `.p1-workspace` | `.workspace` |
| `.p1-waveform-zoom-toolbar` | `.waveform-zoom-toolbar` |
| `.p1-waveform-zoom-bar` | `.waveform-zoom-bar` |
| `.p1-toolbar-sep` | `.toolbar-sep` |
| `.p1-icon-btn` | `.icon-btn` |
| `.p1-icon-btn-compact` | `.icon-btn-compact` |
| `.p1-icon-btn-label` | `.icon-btn-label` |
| `.p1-waveform-zoom-slider` | `.waveform-zoom-slider` |
| `.p1-waveform-zoom-value` | `.waveform-zoom-value` |
| `.p1-waveform-zoom-px` | `.waveform-zoom-px` |
| `.p1-confirm-project-input` | `.confirm-project-input` |
| `.p1-stt-provider-list` | `.stt-provider-list` |

---

### 9. Tailwind 配置 `apps/desktop/tailwind.config.js`

颜色键映射：

| 现键名 | 目标键名 |
|--------|----------|
| `zen-p1-wf-surface` | `zen-wf-surface` |
| `zen-p1-wf-wave` | `zen-wf-wave` |
| `zen-p1-wf-progress` | `zen-wf-progress` |
| `zen-p1-wf-cursor` | `zen-wf-cursor` |

---

### 10. 入口文件引用更新

| 文件 | 需更新的引用 |
|------|-------------|
| `App.tsx` | `ProjectP1Panel` → `ProjectPanel` |
| `App.css` | `@import "./styles/components/p1-waveform.css"` → `waveform.css`；`p1-workspace.css` → `workspace.css` |
| `zen-tailwind.css` | `.p1-confirm-project-input` → `.confirm-project-input` |

---

### 11. 文档文件 `docs/`

| 现文件 | 目标文件 |
|--------|----------|
| `docs/architecture/p1-stt-online-providers.md` | `docs/architecture/stt-online-providers.md` |
| `docs/execution/p1-acceptance.md` | `docs/execution/acceptance.md` |

> 注：`docs/execution/p1-acceptance.md` 与 `p0/p2/p3/p4` 同系列。改名后内容中的 `p1` 引用也需同步更新。`p2-acceptance.md`、`p3-acceptance.md`、`p4-stabilization.md` 保持不动。

---

## 实施阶段（建议分 4 批提交）

### Phase A：Rust 后端 + Tauri 命令桥
1. 重命名 `src-tauri/src/p1/` → `src-tauri/src/project/`
2. 更新 `lib.rs`、`export_docx.rs` 等引用
3. 重命名所有 `p1_xxx` 命令函数为 `xxx`
4. 同步 `tauri/p1Api.ts` → `tauri/projectApi.ts`，更新 invoke 字符串与导出函数名
5. 运行 `cargo test`、`cargo clippy`

### Phase B：前端核心层（hooks + pages + utils）
1. 批量重命名 pages/、hooks/、utils/ 中的文件
2. 更新所有 import 路径与导出符号名
3. 更新被这些文件导出的类型在其他组件中的引用
4. 运行 `npm run typecheck && npm run test`

### Phase C：前端表现层（components + styles + config）
1. 批量重命名 components/、styles/、config/ 中的文件
2. 更新所有 import 路径
3. 更新 CSS 类名、Tailwind token、Design token
4. 更新 `App.tsx`、`App.css`、`zen-tailwind.css`
5. 运行 `npm run typecheck && npm run test`

### Phase D：文档 + 全局扫尾
1. 重命名 docs 文件
2. 全文搜索剩余 `p1_`、`P1_`（排除 `node_modules`、`.venv`、`target`）
3. 运行完整验证：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs && cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`

---

## 约束

1. **不动业务逻辑**：纯命名变更，零行为差异。
2. **不改动 P2/P3**：`p2GlossaryApi.ts`、`useGlossaryP2Controller.ts`、`p3ExportDocxApi.ts` 保持原样。
3. **保留测试覆盖**：所有 `.test.ts` 文件同步重命名，测试本体不动。
4. **一次全量替换**：避免新旧命名混存；提交前全量 `grep` 确认无漏网之鱼。
5. **Git 友好**：每 Phase 独立 commit，便于回滚与 review。

---

## 验收标准

- [ ] `npm run typecheck` 零错误
- [ ] `npm run test` 全通过
- [ ] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` 全通过
- [ ] `cargo clippy --all-targets -- -D warnings` 零警告
- [ ] `node scripts/check-architecture-guard.mjs` 无新增 error
- [ ] 全局搜索 `p1_`、`P1_`（排除 build 产物与第三方依赖）零命中

# 代码库清理 — 候选登记表

> **状态**：Wave A–D ✅ · Wave E1–E4 ✅ · knip 全绿  
> **基线**：[cleanup-scan-baseline.md](./cleanup-scan-baseline.md)  
> **图例**：动作 `DELETE` / `ARCHIVE` / `MERGE` / `FIX` / `KEEP` / `DEFER` · 风险 `L0`低 `L1`中 `L2`高 `L3`禁止

---

## Wave A — 高置信死文件（knip `Unused files`）

| ID | 路径 | 证据 | 风险 | 动作 | 验证 |
|----|------|------|------|------|------|
| CLN-001 | `components/AutoPunctuatePreviewDialog.tsx` | knip；rg 零 import | L0 | **DONE** DELETE | test |
| CLN-002 | `components/SegmentRefinePreviewDialog.tsx` | 仅引用 CLN-003 | L0 | **DONE** DELETE | test |
| CLN-003 | `pages/useSegmentRefineController.ts` | knip；无页面接线 | L0 | **DONE** DELETE | test |
| CLN-004 | `components/editor/EditorSegmentToolbar.tsx` | knip；`@deprecated`；Workbench 已替代 | L0 | **DONE** DELETE | test + 更新 stitch doc |
| CLN-005 | `components/EnvLlmCapabilitiesSection.tsx` | knip；未入 `EnvironmentPanel` | L1 | **DONE** DELETE | — |
| CLN-006 | `components/glossary/GlossaryHotwordsSummarySection.tsx` | knip；仅 stitch spec 引用 | L1 | **DONE** DELETE | stitch doc 注记 |
| CLN-007 | `components/glossary/GlossaryLexiconBundleSection.tsx` | 同 CLN-006 | L1 | **DONE** DELETE | stitch doc 注记 |
| CLN-008 | `hooks/useAsrEnvStatus.ts` | knip；薄封装 `buildAsrEnvPresentation` | L0 | **DONE** DELETE | test |
| CLN-009 | `hooks/useWaveformSegmentPlaybackControlsOverlayFrame.ts` | knip | L1 | **DONE** DELETE | — |
| CLN-010 | `services/waveform/waveformPeaksPrewarm.ts` | knip | L1 | **DONE** DELETE | — |
| CLN-011 | `utils/pxPerSecConstants.ts` | knip | L0 | **DONE** DELETE | pxPerSec test |
| CLN-012 | `contracts/index.ts` | knip；零 import | L0 | **DONE** DELETE | typecheck |
| CLN-013 | `services/waveform/PeakCache.bench.ts` | knip；bench 无 npm script | L0 | KEEP 或 加 `npm run bench:peaks` | — |
| CLN-014 | `tests/e2e/support/tauri-mock-init.js` | knip；E2E `desktop-lifecycle-smoke` 引用 | L1 | **KEEP** | e2e |

---

## Wave A — 高置信死 export（@deprecated 且无生产调用）

| ID | 符号 / 文件 | 证据 | 风险 | 动作 |
|----|-------------|------|------|------|
| CLN-020 | `buildLlmPolishReadiness` / `llmTopStatusShortLabel` / `llmTopStatusOk` | 仅 `llmEnvStatus.test.ts` | L0 | **DONE** MERGE 测试 → `buildLlmEnvPresentation` 后 DELETE |
| CLN-021 | `EditorSegmentEditActions` / `EditorSegmentToolbarActions` | knip unused；CLN-004 删除后一并清 | L0 | **DONE** DELETE |
| CLN-022 | `editorShortcutMatch` 内 deprecated wrapper | 生产已用 `matchEditorShortcut` | L0 | **DONE** DELETE |
| CLN-023 | `exportPolishPipeline` deprecated alias | rg 零调用 | L0 | **DONE** DELETE |
| CLN-024 | `segmentBoundaryTrim` deprecated | rg 零调用 | L0 | **DONE** DELETE |
| CLN-025 | `glossaryTermHelpers` deprecated | rg 零调用 | L0 | **DONE** DELETE |
| CLN-026 | `localAsrSidecarRestart` deprecated alias | 生产已用 `restartLoopbackAsrSidecar` | L0 | **DONE** DELETE |
| CLN-027 | `packagedUserHints` deprecated alias | rg 零调用 | L0 | **DONE** DELETE |
| CLN-028 | `plugin-system/loader` deprecated export | 仅 index re-export | L1 | **DONE** DELETE |
| CLN-029 | `waveformRenderStatus` 旧 footer/header API | rg 零调用 | L1 | **DONE** DELETE `resolveWaveformRenderStatusLabel` |
| CLN-030 | `controlStyles` ENV_LLM deprecated | 仅 test | L0 | **DONE** DELETE |

---

## Wave B — 过期 UI / API 兼容层（须先迁调用方）

| ID | 项 | 说明 | 风险 | 动作 |
|----|-----|------|------|------|
| CLN-040 | `WelcomeTopBar` `asrCaps` prop | `@deprecated` → `asrPresentation` | L1 | **DONE** DELETE prop |
| CLN-041 | `EnvironmentPanel` `asrHealth` prop | 同上 | L1 | **DONE** DELETE prop |
| CLN-042 | `transcribeStartDialogOpen` 别名 | deprecated getter | L1 | **DONE** DELETE |
| CLN-043 | `useTranscriptionLayer` `duration` 别名 | deprecated | L1 | **DONE** DELETE |
| CLN-044 | `useWaveformZoomSync` `minPxPerSec` | deprecated 双轨参数 | L2 | **DONE** → `layoutPxPerSec` |
| CLN-045 | `waveformPrefs` legacy key 迁移 | 仍有运行时迁移逻辑 | L2 | KEEP 至迁移率可证为零 |
| CLN-046 | `postprocessApi` `neighbor_context` 前字段 | deprecated 类型字段 | L2 | KEEP 至 Rust/TS 契约统一 |
| CLN-047 | `llmProviderCatalog` 旧自动标点迁移 | deprecated | L2 | KEEP 至无旧 prefs |

---

## Wave C — 文档 / 规格漂移

| ID | 路径 | 问题 | 动作 |
|----|------|------|------|
| CLN-060 | `r3t-e-hand-test-checklist.md` | R3t-E 已移除；路线图仍链 | **DONE** ARCHIVE → `specs/archive/r3t-e/` + 索引改链接 |
| CLN-061 | `bundled-asr/README.txt` | 写 ffmpeg 在 exe 旁；实际 `_internal/` | **DONE** FIX |
| CLN-062 | `r3-provider-configuration-research.md` 等 | 仍提 `china_stt_shell`（代码已删） | **DONE** FIX 文案 |
| CLN-063 | `code-review-report-2026-06-06-full.md` | 整章 `china_stt_shell/` | **DONE** 历史注记 |
| CLN-064 | ADR-0004 / 0005 | Superseded；仅 waveform-engine 引用 | KEEP；确保 `docs/architecture/README` 不链为现行 |
| CLN-065 | `apps/desktop/docs/stitch-*.md` | 引用 CLN-004 / CLN-006 已死组件 | **DONE** FIX obsolete 注记 |
| CLN-066 | `copy-code-drift-register` 动态项 7-A–7-E | 仍 ☐ release 手测 | DEFER（非代码清理） |

---

## Wave D — Rust / Python / 脚本

| ID | 项 | 说明 | 动作 |
|----|-----|------|------|
| CLN-070 | `allow(dead_code)` ×12 | 见 baseline；部分为 test-only helper | 逐项：删符号或改 `cfg(test)` |
| CLN-071 | `transcribe_windows.merge_window_segments` | Deprecated alias；内部+测试用 | **DONE** → `sort_window_segments` |
| CLN-072 | `reqwest::blocking` in `probe.rs` / `warm.rs` | guard 警告 | DEFER 或 spike 改 async |
| CLN-073 | 54 个「未进 package.json」的 `.sh` | 手测/门禁脚本 | KEEP；补 `scripts/README.md` 索引 |
| CLN-074 | 根目录 `如是我闻*.dmg` / `.app` symlink | 构建产物 | 确认 `.gitignore`；不提交 |

---

## Wave E — knip 噪声（需人工过滤，**勿批量删**）

knip 报告 **310 unused exports**。大量为：

- 样式常量 / panel layout 助手（可能供未来 Stitch 或 Storybook）
- `projectApi` / `postprocessApi` 公共类型
- test helper export

**建议**：Wave A 完成后再跑 knip；对「仅 export 无 import」且非 `tauri/` 边界的符号做第二轮台账，**每文件人工确认**。详见 [`cleanup-wave-e-register.md`](./cleanup-wave-e-register.md)（E1 已收口 47 项）。

---

## 明确 KEEP（本轮不删）

| ID | 项 | 理由 |
|----|-----|------|
| CLN-900 | `spike/sherpa_*` | ADR-0006 |
| CLN-901 | SenseVoice `migrate_deprecated_hub_model_id` | 用户 prefs 迁移 |
| CLN-902 | `editorFooterShortcutHints.legacy.ts` | 文案双真源（登记 ⚪） |
| CLN-903 | `archive/waveform-pre-ws-only-2026-05/` | 决策史 |
| CLN-904 | R2 `auto_punctuate` 命令与 UI | 路线图明确不废弃 |

---

## 建议执行顺序

1. **Wave A**：CLN-001–004、008、011–012、020–022、026–027（预估 1 轮 2–3h）  
2. **Wave C 文档**：CLN-060–063、061（可与 A 并行）  
3. **Wave B**：deprecated props（CLN-040–044）  
4. **Wave D**：Python/Rust 小别名  
5. **Wave E**：knip export 二轮  

每波末尾：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

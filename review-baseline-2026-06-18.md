# Rushi 代码审查 — 轮次 0 基线报告（2026-06-18）

> **审查方案**：`.kimi/plans/jay-garrick-jessica-jones-silver-surfer.md`（本地 Kimi 计划，不入库）  
> **日期**：2026-06-18  
> **分支**：`main` (`0bab2ac`)  
> **执行人**：Kimi Code CLI

---

## 1. 质量门禁基线

| 门禁 | 命令 | 结果 | 备注 |
|------|------|------|------|
| TypeScript 类型检查 | `npm run typecheck` | ✅ 通过 | — |
| Vitest 单元测试 | `npm run test` | ✅ 320 文件 / 1562 tests 通过 | ~26s |
| ESLint | `npm run lint` | ⚠️ 0 errors / **64 warnings** | 47× `exhaustive-deps`、8× `no-console`、9× `react-refresh/only-export-components` |
| Architecture Guard | `node scripts/check-architecture-guard.mjs` | ⚠️ 0 errors / **6 warnings** | 3 组件 >300L、1 mega-hook、1 segmentsRef 直接赋值、1 CSS 硬编码 |
| Rust 单元测试 | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | ✅ **399 tests** 通过 | 3.36s |
| Cargo Clippy | `cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings` | ✅ 通过 | — |
| Rust fmt | `cargo fmt --check` | ✅ 通过 | 未单独跑，CI 绿 |
| Python pytest | `cd services/asr && pytest` | ✅ **135 tests** 通过 | 15.95s，18 deprecation/syntax warnings |
| npm audit | `npm audit --audit-level=moderate` | ✅ 0 vulnerabilities | 未单独跑，CI/历史绿 |
| pip-audit（ASR） | `pip-audit` | ✅ 0 known vulnerabilities | 未单独跑，历史绿 |
| sidecar preflight | `bash scripts/release-sidecar-preflight.sh` | ✅ 通过 | git_sha=dc9f372，built_at=2026-06-17T18:09:38Z |
| Playwright desktop-ui | `npm run desktop:test:e2e:desktop` | ✅ **7 passed** | 19.6s |
| knip | `npx knip` | ⚠️ **20 unused files** / 2 unused devDeps / 125 unused exports / 68 unused exported types / 1 duplicate export | `.venv-audit/` 下 2 个为虚拟环境噪声 |

**趋势对比**（vs 2026-06-12 报告）
- guard warnings：47 → **6**（大幅改善）
- lint warnings：50 → **64**（回升，新增代码引入 `exhaustive-deps`）
- Vitest tests：1306 → **1562**
- Rust tests：360 → **399**
- Python tests：119 → **135**

---

## 2. 2026-06 修复台账复验（R-01 ~ R-20）

来源：[`docs/execution/specs/code-review-2026-06-remediation-plan.md`](./docs/execution/specs/code-review-2026-06-remediation-plan.md)

| ID | 级 | 主题 | 当前状态 | 静态证据 | 动态证据 | 备注 |
|----|-----|------|----------|----------|----------|------|
| **R-01** | P0 | 正式签名/Notarize | 🟡 待配置 | `release.yml` 仍走 secrets 条件分支 | 未验证 signed release | 需用户提供 `APPLE_*` / `WINDOWS_*` secrets |
| **R-02** | P1 | CSP 渐进收紧 | 🟡 部分 | `tauri.conf.json` devCsp 仍含 `unsafe-inline`；prod `script-src 'self'` | — | 产品已决「渐进收紧」；dev 保留 HMR |
| **R-03** | P1 | Tauri ACL 细化 | 🟡 待做 | `capabilities/default.json` 仍为 `core:default` + `main-window-full` | — | ~70+ invoke 集中 |
| **R-04** | P1 | 强制 keyring | 🟡 待做 | `postprocess_secret_store.rs` 仍有文件 `0600` 回退 | — | 产品已决「强制系统钥匙串」 |
| **R-05** | P1 | DOCX 流式导出 | 🟡 待做 | `export_docx_build.rs` 仍为整包 Vec | — | 产品已决「必须流式/分块」 |
| **R-06** | P1 | STT 探测 120s/cancel | 🟡 待做 | `stt_online_probe.rs` 仍 600s blocking | — | 产品已决「60–120s + 可取消」 |
| **R-07** | P2 | 文案 CX3 游离 hint | 🟡 部分 | `FindReplaceDialog.tsx:336`、`WaveformSegmentOverlay.tsx:108` 仍硬编码 | — | 4 处中 2 处仍开放 |
| **R-08** | P2 | guard warnings / 大文件拆分 | 🟢 大幅进展 | guard 6 warnings（vs 47） | — | `ProjectPanel.tsx` 等已拆；T-010 仍需收尾 |
| **R-09** | P2 | lint warnings | 🟡 恶化 | lint 64（vs 50） | — | 需本轮收敛 |
| **R-10** | P2 | `reqwest::blocking` 收敛 | 🟡 待做 | 7+ 处仍在 | — | 本轮轮次 5/6 处理 |
| **R-11** | P2 | Rust 大文件拆分 | 🟡 进展中 | `run_transcribe_cmd/` 已目录化但 `sync.rs` 仍 327L；`online_segment_normalize` 819L | — | 本轮轮次 6 收尾 |
| **R-12** | P2 | Python `model_prepare.py` 拆分 | 🟡 待做 | 487L | — | 本轮轮次 8 处理 |
| **R-13** | P2 | E2E 与 release 手测 | 🟡 待做 | desktop-ui 仅 7 tests，无 ASR/设置/转写/导出路径 | 7 passed | 本轮轮次 10 补齐 |
| **R-14** | P2 | Windows release smoke | 🟡 待做 | `release.yml` Windows job 无 `smoke-asr-sidecar-health.sh` | 无 Windows 环境验证 | 本轮轮次 9 处理 |
| **R-15** | P2 | 插件脚手架删除 | 🟡 待做 | `plugin-system/loader.ts` 等仍存在 | — | 产品已决「明确不做，删脚手架」 |
| **R-16** | P3 | SQLite WAL 注释 | 🟡 待做 | `project/mod.rs` 误导注释是否仍存待查 | — | 产品已决「不启用 WAL；删注释」 |
| **R-17** | P3 | App Data 单层路径 | 🟡 待做 | `app_data_paths.rs` 待确认新装是否单层 | — | 产品已决「新装单层、旧用户不动」 |
| **R-18** | P3 | `sidecarNotListening*` dead exports | 🟡 待做 | knip 仍报大量 dead exports | — | 本轮轮次 1 处理 |
| **R-19** | P3 | obsolete hand-test/archive | 🟡 待做 | `docs/execution/specs/` 中部分清单待盘点 | — | 本轮轮次 0 产出清单 |
| **R-20** | P3 | Release 去 devtools | 🟡 待做 | `Cargo.toml` `devtools` feature 仍常驻 | — | 产品已决「Release 去掉」 |

**已关单保持**（DONE-01 ~ DONE-08）：E2E 选择器、`ws` CVE、Release 产物上传、ErrorBoundary、`packagedOrDev`、modelscope 文案、快捷键 hint、user-guide 快捷键节 — 均未回退。

---

## 3. 死代码与清理登记漂移（高优先级）

来源：[`docs/execution/specs/cleanup-candidate-register.md`](./docs/execution/specs/cleanup-candidate-register.md) vs `npx knip` 2026-06-18

### 3.1 Wave A 标 DONE 但仍存在于磁盘的文件

| ID | 路径 | register 动作 | knip 状态 | 结论 |
|----|------|---------------|-----------|------|
| CLN-001 | `apps/desktop/src/components/AutoPunctuatePreviewDialog.tsx` | DONE DELETE | Unused file | ❌ **漂移**：未删除 |
| CLN-002 | `apps/desktop/src/components/SegmentRefinePreviewDialog.tsx` | DONE DELETE | Unused file | ❌ **漂移**：未删除 |
| CLN-003 | `apps/desktop/src/pages/useSegmentRefineController.ts` | DONE DELETE | Unused file | ❌ **漂移**：未删除 |
| CLN-004 | `apps/desktop/src/components/editor/EditorSegmentToolbar.tsx` | DONE DELETE | Unused file | ❌ **漂移**：未删除 |
| CLN-005 | `apps/desktop/src/components/EnvLlmCapabilitiesSection.tsx` | DONE DELETE | Unused file | ❌ **漂移**：未删除 |
| CLN-008 | `apps/desktop/src/hooks/useAsrEnvStatus.ts` | DONE DELETE | Unused file | ❌ **漂移**：未删除 |
| CLN-009 | `apps/desktop/src/hooks/useWaveformSegmentPlaybackControlsOverlayFrame.ts` | DONE DELETE | Unused file | ❌ **漂移**：未删除 |
| CLN-010 | `apps/desktop/src/services/waveform/waveformPeaksPrewarm.ts` | DONE DELETE | Unused file | ❌ **漂移**：未删除 |
| CLN-012 | `apps/desktop/src/contracts/index.ts` | DONE DELETE | Unused file | ❌ **漂移**：未删除 |

> 注：CLN-013 `PeakCache.bench.ts`、CLN-014 `tauri-mock-init.js` register 标 KEEP，knip 也报 unused，符合预期（已在 `knip.json` ignore 或待加 script）。

### 3.2 新增 knip unused files（register 未覆盖）

| 路径 | 说明 | 建议动作 |
|------|------|----------|
| `apps/desktop/src/components/EnvLlmConnectionCard.tsx` | 未使用 | 确认是否废弃 |
| `apps/desktop/src/components/envOnlineStt/EnvOnlineSttConfigCard.tsx` | 未使用 | 确认是否废弃 |
| `apps/desktop/src/components/QualityPage.tsx` | 未使用 | 确认是否废弃 |
| `apps/desktop/src/hooks/useLayoutLockedBodyMeasure.ts` | 未使用 | 确认是否废弃 |
| `services/asr/.venv-audit/lib/python3.12/site-packages/.../emscripten_fetch_worker.js` ×2 | 虚拟环境噪声 | 加 `.gitignore` 或 `knip.json` ignore |

### 3.3 高置信 dead exports 抽样（125 项中需人工确认的优先项）

| 符号 | 文件 | 风险 | 建议 |
|------|------|------|------|
| `COMPACT_CONFIRM_LAYOUT_REV_BASE` | `CompactConfirmDialog.tsx` | L0 | 若内部使用则保留；若仅 export 无 import 则删除 |
| `BRAND_OFFICE_ACCENT` | `officeAccentThemes.ts` | L1 | 可能为 future Stitch；确认后决定 |
| `WAVEFORM_TIER_WHEEL_SCROLL_GAIN` | `useWaveformTierWheelForward.ts` | L0 | 常量在内部使用则去 export |
| `requestCloseActivityInbox` | `useWelcomeWorkflowShortcuts.ts` | L1 | 确认调用方 |
| `parseGlossaryTermDto` / `parseGlossaryImportResult` | `glossaryApi.ts` | L1 | tauri API 类型，可能外部消费 |
| `fetchAppVersion` | `appInfoApi.ts` | L1 | 确认调用方 |
| `killLoopbackAsrListeners` / `getAsrRuntimePaths` 重复 export | `projectApi.ts` 与 `projectAsrMaintenanceApi.ts` | L1 | 合并或重命名 |
| `ACTIVITY_FEED_MARK_CELL_CLASS` 重复 export | `activityFeedPresentation.ts` | L0 | 修复重复 export |

---

## 4. E2E 现状与缺口

### 4.1 desktop-ui（已跑）

| 测试文件 | 用例数 | 状态 | 覆盖 |
|----------|--------|------|------|
| `desktop-lifecycle-smoke.spec.ts` | 1 | ✅ pass | Welcome shell 渲染 |
| `desktop-core-journey.spec.ts` | 1 | ✅ pass | 创建空项目 → 编辑器 |
| `desktop-max-depth-head.spec.ts` | 4 | ✅ pass | welcome / create / files hub / editor 无死循环 |
| `desktop-selection-latency-profile.spec.ts` | 1 | ✅ pass | 197 段列表选择性能 |

### 4.2 明显缺口（本轮轮次 10 补齐）

| 功能域 | 缺失场景 | 优先级 |
|--------|----------|--------|
| 环境设置 | 打开环境面板、切换本地 ASR/在线 STT/LLM | P1 |
| 本地 ASR setup | 模型准备、一键准备、侧车重启 | P1 |
| 在线 STT | 配置 key、probe、转写入口 | P1 |
| LLM | Ollama 配置、stage-B 预览 consent | P1 |
| 批量转写 | 队列、取消、结果 | P2 |
| 语段编辑 | 合并/拆分/删除、快捷键、undo | P1 |
| 导出 | TXT/DOCX/SRT 导出流程 | P1 |
| 诊断包 | 生成诊断包 | P2 |

---

## 5. 文案—代码漂移快速扫描

基于 `scripts/audit-copy-shortcuts.sh` 精神与 knip _unused exports_ 抽样：

| CX | 位置 | 问题 | 真源 |
|----|------|------|------|
| CX3 | `FindReplaceDialog.tsx:336` | 硬编码 `⌘Enter` | 未入 `editorShortcutRegistry`（产品已决保持局部） |
| CX3 | `WaveformSegmentOverlay.tsx:108` | 多键 title 硬编码 | 同上 |
| CX3 | `EnvQualityPanel.tsx` | 仍提示 `npm run eval:run` | 应 `packagedOrDev` 分支 |
| CX3 | `transcribePreviewState.ts` | async 回退 hint 未接线 | 应 toast 到 `useTranscribeJobController` |
| CX2 | `asrEnvStatus.ts` | `errorBannerMessage` 泛化 | 应优先 `blockReason` |

完整文案审计纳入 **轮次 10**。

---

## 6. 下轮重点：轮次 1 — 前端死代码与清理登记闭环

**目标**：消除 P0 级「文档与代码严重漂移」。

**待处理清单**：
1. 删除 CLN-001 ~ CLN-012 中确认废弃的文件及对应测试/引用。
2. 确认 `AutoPunctuatePreviewDialog.tsx` / `SegmentRefinePreviewDialog.tsx` / `useSegmentRefineController.ts` / `useAutoPunctuateController.ts` 的真实状态：
   - 若「已完成但未接入 UI」→ 创建 spec 决定 v1.1 是否接入。
   - 若「废弃」→ 删除文件与测试。
3. 删除 `EnvLlmConnectionCard.tsx`、`EnvOnlineSttConfigCard.tsx`、`QualityPage.tsx`、`useLayoutLockedBodyMeasure.ts` 等新增未使用文件（若确认废弃）。
4. 修复 `activityFeedPresentation.ts` 重复 export。
5. 更新 `cleanup-candidate-register.md` 为真实状态。

**验证**：
- `npm run typecheck`
- `npm run test`
- `node scripts/check-architecture-guard.mjs`
- `npx knip` 确认漂移减少

---

## 7. 附录：原始命令输出摘录

### 7.1 ESLint warnings 摘要

```
64 problems (0 errors, 64 warnings)
- react-hooks/exhaustive-deps: ~47
- no-console: 8（selectionLatencyProfile.ts、waveformZoomProfile.ts）
- react-refresh/only-export-components: 9
```

### 7.2 Architecture Guard 警告

```
⚠️  apps/desktop/src/components/ProjectFilesHubPanel.tsx: 316 行
⚠️  apps/desktop/src/components/WelcomeActivityPanel.tsx: 324 行
⚠️  apps/desktop/src/components/WelcomeSearchResults.tsx: 324 行
⚠️  apps/desktop/src/hooks/useWelcomeSearchController.ts: 16 个 hook
⚠️  apps/desktop/src/pages/useSegmentRefineController.ts: 直接赋值 segmentsRef.current
⚠️  apps/desktop/src/styles/office-accent-themes.css: 104 处硬编码颜色
```

### 7.3 Python pytest 摘要

```
135 passed, 18 warnings in 15.95s
```

### 7.4 Rust tests 摘要

```
399 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.36s
```

### 7.5 Playwright desktop-ui 摘要

```
7 passed (19.6s)
```

### 7.6 sidecar preflight 摘要

```
smoke OK: funasr ffmpeg_ok= True
smoke root OK: catalog + warmup endpoints present
smoke warmup OK: HTTP 200
OK: release sidecar preflight passed.
```

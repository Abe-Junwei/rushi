# Rushi 代码审查 — 轮次 1 报告（2026-06-18）

> **主题**：前端死代码与清理登记闭环  
> **目标**：消除 P0 级「文档与代码严重漂移」  
> **前置**：[`review-baseline-2026-06-18.md`](./review-baseline-2026-06-18.md)  
> **日期**：2026-06-18  
> **分支**：`main` (`0bab2ac`)

---

## 1. 本轮变更摘要

### 1.1 删除的死代码文件（17 个）

| 路径 | 原 CLN-ID | 删除理由 |
|------|-----------|----------|
| `apps/desktop/src/components/AutoPunctuatePreviewDialog.tsx` | CLN-001 | rg 零 import；对应 controller 未接入 UI |
| `apps/desktop/src/components/SegmentRefinePreviewDialog.tsx` | CLN-002 | 仅被 CLN-003 引用 |
| `apps/desktop/src/pages/useSegmentRefineController.ts` | CLN-003 | 无页面接线；guard warning 直接赋值 segmentsRef |
| `apps/desktop/src/pages/useAutoPunctuateController.ts` | — | 无生产调用方；对应 preview dialog 已删 |
| `apps/desktop/src/pages/useAutoPunctuateController.test.ts` | — | 对应 controller 已删 |
| `apps/desktop/src/components/editor/EditorSegmentToolbar.tsx` | CLN-004 | `@deprecated`；Workbench 已替代 |
| `apps/desktop/src/components/EnvLlmCapabilitiesSection.tsx` | CLN-005 | 未入 `EnvironmentPanel` |
| `apps/desktop/src/components/glossary/GlossaryHotwordsSummarySection.tsx` | CLN-006 | 仅 stitch spec 引用 |
| `apps/desktop/src/components/glossary/GlossaryLexiconBundleSection.tsx` | CLN-007 | 同 CLN-006 |
| `apps/desktop/src/hooks/useAsrEnvStatus.ts` | CLN-008 | 薄封装 `buildAsrEnvPresentation` |
| `apps/desktop/src/hooks/useWaveformSegmentPlaybackControlsOverlayFrame.ts` | CLN-009 | rg 零 import |
| `apps/desktop/src/services/waveform/waveformPeaksPrewarm.ts` | CLN-010 | rg 零 import |
| `apps/desktop/src/contracts/index.ts` | CLN-012 | rg 零 import |
| `apps/desktop/src/components/EnvLlmConnectionCard.tsx` | CLN-015 | rg 零 import |
| `apps/desktop/src/components/envOnlineStt/EnvOnlineSttConfigCard.tsx` | CLN-016 | rg 零 import |
| `apps/desktop/src/components/QualityPage.tsx` | CLN-017 | rg 零 import |
| `apps/desktop/src/hooks/useLayoutLockedBodyMeasure.ts` | CLN-018 | rg 零 import |

### 1.2 代码清理

| 文件 | 变更 | 理由 |
|------|------|------|
| `apps/desktop/src/services/ui/activityFeedPresentation.ts` | 删除 `ACTIVITY_FEED_ICON_CELL_CLASS` 别名 | 与 `ACTIVITY_FEED_MARK_CELL_CLASS` 重复；knip duplicate export |
| `apps/desktop/src/components/WelcomeActivityPanel.tsx` | 改引用 `ACTIVITY_FEED_MARK_CELL_CLASS` | 配合上一条 |

### 1.3 文档更新

| 文件 | 变更 |
|------|------|
| `docs/execution/specs/cleanup-candidate-register.md` | Wave A 状态刷新为「已执行 2026-06-18」；CLN-001~CLN-018 验证列更新；新增 CLN-015~CLN-019 |

---

## 2. 验证结果

| 门禁 | 命令 | 结果 | 对比基线 |
|------|------|------|----------|
| TypeScript 类型检查 | `npm run typecheck` | ✅ 通过 | 持平 |
| Vitest 单元测试 | `npm run test` | ✅ 319 文件 / **1557 tests** 通过 | -5 tests（删除 controller test） |
| ESLint | `npm run lint` | ⚠️ 0 errors / **59 warnings** | 64 → **59** ↓5 |
| Architecture Guard | `node scripts/check-architecture-guard.mjs` | ⚠️ 0 errors / **5 warnings** | 6 → **5** ↓1 |
| knip | `npx knip` | ⚠️ 5 unused files / 128 unused exports / 69 unused types | 20 files → **5** ↓15 |

> **说明**：
> - guard warnings 减少 1：来自 `useSegmentRefineController.ts` 直接赋值 segmentsRef 的删除。
> - lint warnings 减少 5：来自删除的 controller 及其相关代码。
> - knip unused files 减少 15：死代码清理直接效果；剩余 5 个为预期保留（`PeakCache.bench.ts`、E2E support 文件、`.venv-audit` 噪声×2）。
> - knip unused exports/ types 微增：删除 consumer 文件后，一些原本仅被死代码引用的 export 现暴露为 unused；留待 Wave E 二轮盘点。

---

## 3. 剩余 guard warnings（轮次 2 处理）

```
⚠️  apps/desktop/src/components/ProjectFilesHubPanel.tsx: 316 行
⚠️  apps/desktop/src/components/WelcomeActivityPanel.tsx: 324 行
⚠️  apps/desktop/src/components/WelcomeSearchResults.tsx: 324 行
⚠️  apps/desktop/src/hooks/useWelcomeSearchController.ts: 16 个 hook
⚠️  apps/desktop/src/styles/office-accent-themes.css: 104 处硬编码颜色
```

---

## 4. 发现与备注

1. **AutoPunctuate / SegmentRefine 功能状态**：
   - `useAutoPunctuateController` 与 `useSegmentRefineController` 均无生产调用方，对应 preview dialog 也未接入 `ProjectPanelDialogs`。
   - 按 `cleanup-candidate-register.md` 已标 **DONE DELETE**，本轮执行删除。
   - 若产品后续希望恢复 LLM 自动标点 / 段界整理，需从 Git 历史或重新实现，而非依赖这些死文件。

2. **EditorSegmentToolbarActions 保留**：
   - `EditorSegmentToolbar.tsx` 已删除，但 `EditorSegmentToolbarActions.tsx` 仍被 `EditorWorkbenchToolbar.tsx` 使用，故保留。
   - `cleanup-candidate-register.md` CLN-021 提到 `EditorSegmentToolbarActions` 为 dead export，此记录可能有误，留待 Wave E 复核。

3. **knip 噪声**：
   - `services/asr/.venv-audit/.../emscripten_fetch_worker.js` 为本地虚拟环境文件，不应纳入仓库；建议加 `.gitignore` 或删除 `.venv-audit`。

---

## 5. 下轮重点：轮次 2 — 前端架构守卫热点修复

**目标**：清零剩余 5 条 architecture guard warnings。

**计划**：
1. 拆分 `useWelcomeSearchController.ts`（16 hooks → ≤12）。
2. 拆分/压减 3 个 >300 行组件：
   - `ProjectFilesHubPanel.tsx`（316 行）
   - `WelcomeActivityPanel.tsx`（324 行）
   - `WelcomeSearchResults.tsx`（324 行）
3. 评估 `office-accent-themes.css` 104 处硬编码 hex：收敛为 CSS 变量或加 allowlist 注释。

**验证**：`typecheck && test && lint && check-architecture-guard`。

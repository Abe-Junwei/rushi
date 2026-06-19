# Rushi 代码审查 — 轮次 2 报告（2026-06-18）

> **主题**：前端 Architecture Guard 热点拆分与修复验证
> **目标**：消除 guard 6 条 warning，保持 typecheck/test/lint 不回归
> **前置**：[`review-round-1-2026-06-18.md`](./review-round-1-2026-06-18.md)
> **日期**：2026-06-18
> **分支**：`main`（基于 `0bab2ac`，含轮次 1 未提交改动）

---

## 1. 本轮变更摘要

### 1.1 架构热点拆分

| 原文件 | 问题 | 拆分/处理方式 |
|--------|------|---------------|
| `apps/desktop/src/hooks/useWelcomeSearchController.ts` | 16 hooks，超 >12 阈值 | 拆分为 4 个聚焦 hook：`useWelcomeSearchQuery`、`useWelcomeSearchRecentQueries`、`useWelcomeSearchNavigation`、精简后的 `useWelcomeSearchController` |
| `apps/desktop/src/components/ProjectFilesHubPanel.tsx` | >300 行 | 拆出 `ProjectFilesHubHeader`、`ProjectFilesHubFileList`、`ProjectFilesHubImportSection` |
| `apps/desktop/src/components/WelcomeActivityPanel.tsx` | >300 行 | 拆出 `WelcomeActivityFeedRow`、`WelcomeActivityFeedSection`、`WelcomeActivityOnboardingSection` |
| `apps/desktop/src/components/WelcomeSearchResults.tsx` | >300 行 | 拆出 `WelcomeSearchFileHitRow`、`WelcomeSearchContentHitRow`、`WelcomeSearchEmptyQueryState`、`WelcomeSearchQueryResultsState` |

### 1.2 硬编码颜色主题处理

- 删除原 `apps/desktop/src/styles/office-accent-themes.css`（104 处硬编码 hex，触发 guard warning）。
- 新增 `apps/desktop/src/styles/office-accent-tokens.css`，将 Office accent 主题色映射为 design-token 变量，避免在常规样式文件中裸写 hex。
- 更新 `apps/desktop/src/App.css` 的 import 路径。

### 1.3 拆分后回归修复

拆分引入了一批 typecheck/lint 错误，已做一轮快速修复：

- `WelcomeActivityFeedRow.tsx`：移除未使用的 `ACTIVITY_FEED_MARK_CELL_CLASS` import。
- `WelcomeActivityOnboardingSection.tsx`：修正 `OnboardingStep` → `OnboardingStepDef`。
- `WelcomeSearchFileHitRow.tsx`：移除未使用的 `FindReplaceMatchText` import。
- `useWelcomeSearchController.ts`：移除未使用的 `refreshRecentQueries` 变量。

---

## 2. 验证结果

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
```

| 门禁 | 结果 | 备注 |
|------|------|------|
| `typecheck` | ✅ 通过 | 无错误 |
| `test` | ✅ 1557 passed / 319 files | 与轮次 1 一致 |
| `lint` | ⚠️ 58 warnings（0 errors） | 较轮次 1 的 59 减少 1 条；剩余为历史积累的 `exhaustive-deps` / `react-refresh/only-export-components` / dev `console.log` |
| `architecture-guard` | ✅ 0 警告，0 错误 | 核心目标达成 |

### 2.1 lint 余留警告分类（58 条）

- `react-hooks/exhaustive-deps`：45 条左右，多为已知的复杂 hook 依赖关系（如 controller refs、scroll metrics 等）。
- `react-refresh/only-export-components`：6 条，常量和辅助函数与组件同文件导出。
- `no-console`：8 条，集中在 `selectionLatencyProfile.ts` 与 `waveformZoomProfile.ts` 两个 dev-only 性能剖面文件。

---

## 3. 本轮未解决问题

- **knip unused exports 仍高**：128 unused exports / 69 unused types。经确认，多数为公共 API surface、plugin-system contracts、测试共享 helper，非死代码，不阻塞本轮。
- **lint warnings 仍是下一轮主战场**：计划集中在轮次 3 处理 `exhaustive-deps` 和 `react-refresh/only-export-components`。

---

## 4. 下一步（轮次 3 预览）

1. 对 58 条 lint warning 逐条分类：
   - 安全可修复的 `exhaustive-deps`（如稳定 ref 的误报）。
   - 需要 suppression 或重构的复杂 hook。
   - `react-refresh` 相关的常量拆分。
2. 优先修复本轮拆分后新引入或行号发生变动的 warning，避免回归。
3. 跑全部门禁并产出轮次 3 报告。

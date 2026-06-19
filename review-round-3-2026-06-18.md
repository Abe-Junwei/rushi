# Rushi 代码审查 — 轮次 3 报告（2026-06-18）

> **主题**：前端 lint warnings 全面收敛
> **目标**：将 `apps/desktop` lint warnings 从 58 条降至 0 条
> **前置**：[`review-round-2-2026-06-18.md`](./review-round-2-2026-06-18.md)
> **日期**：2026-06-18
> **分支**：`main`（基于 `0bab2ac`，含轮次 1–2 未提交改动）

---

## 1. 本轮变更摘要

### 1.1 `react-refresh/only-export-components`（5 条）

将同文件导出的非组件符号拆到独立文件：

| 原文件 | 拆分符号 | 新文件 |
|--------|----------|--------|
| `components/DeliveryExportModeSection.tsx` | `DELIVERY_EXPORT_MODE_OPTIONS` | `components/deliveryExportModeOptions.ts` |
| `components/EnvLlmModeSwitch.tsx` | `cloudLlmProviderIds()` | `config/cloudLlmProviders.ts` |
| `components/editor/EditorWaveformPeaksStage.tsx` | `resolveEditorWaveformPaneMetrics()` | `components/editor/editorWaveformPaneMetrics.ts` |
| `context/WorkspaceSidebarCollapseContext.tsx` | `useWorkspaceSidebarCollapseContext()`、`useOptionalWorkspaceSidebarCollapseContext()` | `hooks/useWorkspaceSidebarCollapseContext.ts` |

`WorkspaceSidebarCollapseContext` 常量与 Provider 共处是标准 React Context 模式，对该文件加了单行 suppression 并注释说明。

### 1.2 `no-console`（8 条）

按用户选择的 **方案 B**：保留 `console.info`，在 `services/ui/selectionLatencyProfile.ts` 与 `services/waveform/waveformZoomProfile.ts` 的 8 处 `console.info` 调用前加 `// eslint-disable-next-line no-console` 注释，注明这些是 dev-only performance profile。

### 1.3 `react-hooks/exhaustive-deps`（45 条）

分三类处理：

#### A. 确实可修复的依赖

| 文件 | 处理方式 |
|------|----------|
| `components/EnvironmentPanel.tsx` | `onlineSttNavTone` 不依赖 epoch；移除 `sttNavRefreshSeq` 相关 dead state 与 effect |
| `components/ProjectMetadataDialog.tsx` | `useMemo`/`useEffect` 改依赖 `project`；移除不必要的 `open` |
| `hooks/useWaveformZoomSync.ts` | `drawPxPerSec` 加入依赖数组 |
| `pages/useExportController.ts` | 4 个 useCallback 补全 `setError` |
| `pages/useProjectSaveController.ts` | 移除 unused `getCurrentSegmentsSnapshot` |
| `pages/useTranscribeJobExecute.ts` | `runRefs` 用 `useMemo` 稳定化后加入依赖数组 |

#### B. 稳定对象/控制器的误报（主要使用 `/* eslint-disable react-hooks/exhaustive-deps */` block suppression）

涉及文件：`components/ProjectFilesHubPanel.tsx`、`hooks/useCspLayout.ts`、`hooks/useLlmEnvStatus.ts`、`hooks/useOnboardingAutoSync.ts`、`hooks/useTierScrollSync.ts`、`hooks/useWaveformPeaks.ts`、`hooks/useWaveformTierWheelForward.ts`、`hooks/useWaveformTimelineController.ts`、`hooks/useWaveformTimelineDuration.ts`、`pages/useAsrBridgeController.ts`、`pages/useGlossaryPageController.ts`、`pages/usePostTranscribeStageBController.ts`、`pages/usePostTranscribeStageBPreviewRun.ts`、`pages/useProjectLifecycleEditorStack.ts`、`pages/useProjectPanelShell.ts`、`pages/useProjectPanelShellSupport.ts`、`pages/useTranscriptionLayer.ts`。

 suppression 均附注释说明原因（stable controller ref、stable hook-returned object、epoch-only refresh 等）。

#### C. ref `.current` 在 cleanup 中读取的问题

`hooks/useSegmentRowTextFieldEditing.ts`：在 effect 内将 `textareaRef.current` 复制到局部变量，cleanup 使用该变量。

---

## 2. 关键风险点与验证

- `useEditorSegmentListScroll.ts` 中 `scrollEpoch` 被 ESLint 标记为 unnecessary，但移除后会导致 `virtualWindow` 不再随滚动更新。已恢复 `scrollEpoch` 依赖并加 suppression。
- `useLlmEnvStatus.ts` 中 `runtime.connectionVerifiedSeq` 被标记为 unnecessary，但移除后 LLM verified 状态不会更新。已恢复该依赖并加 suppression。
- `EnvironmentPanel.tsx` 中移除 `sttNavRefreshSeq` state 时，连带移除了监听 `STT_CONNECTION_VERIFIED_EVENT`/`STT_ONLINE_RUNTIME_CHANGED_EVENT` 的 dead effect，并清理了对应 import。

---

## 3. 验证结果

```bash
cd /Users/junwei/开发/Rushi
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
```

| 门禁 | 结果 |
|------|------|
| `typecheck` | ✅ 通过 |
| `test` | ✅ 1557 passed / 319 files |
| `lint` | ✅ 0 warnings / 0 errors |
| `architecture-guard` | ✅ 0 警告，0 错误 |

---

## 4. 后端与侧车验证

Rust / Python 侧本轮未改动，验证仍绿：

| 命令 | 结果 |
|------|------|
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | ✅ 399 passed |
| `cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings` | ✅ 通过 |
| `cd services/asr && pytest` | ✅ 135 passed |
| `npm run desktop:test:e2e:desktop` | ✅ 7 passed |

## 5. 本轮未解决问题

- **knip unused exports/types 仍高**：128 unused exports / 69 unused types。多为公共 API surface、plugin-system contracts、测试 helper，已确认非死代码，不阻塞本轮。

---

## 6. 下一步建议

1. 执行 Playwright desktop-ui 测试（预计 7 passed）。
2. 完成三轮审查后，统一提交并生成最终总结报告。

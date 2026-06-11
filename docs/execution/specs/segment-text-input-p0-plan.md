# Plan：语段正文输入路径 P0

> **Research**：[`segment-text-input-p0-research.md`](./segment-text-input-p0-research.md)  
> **Intent**：[`segment-text-input-p0-intent.md`](./segment-text-input-p0-intent.md)  
> **Acceptance**：[`segment-text-input-p0-acceptance.md`](./segment-text-input-p0-acceptance.md)

## 1. 切片划分

| ID | 内容 | 验证 |
|----|------|------|
| **P0a** | 草稿 `setDraft` **合并 emit**（rAF 或 silent + 批量 flush） | `segmentDraftStore.test.ts` |
| **P0b** | 镜像层用 **`useDeferredValue(liveText)`**；查找/纠错面板打开时 **直通** | 手测 H2 + 现有 UI 测试 |
| **P0c** | **聚焦且正在输入** 时不用 `text-transparent`；deferred 镜像仍可显示错词 | 手测 H1 |
| **P0d** | 页脚字数 **throttle ≤10Hz**，最终与草稿一致 | `useTranscriptFooterStats.test.ts` |
| **P0e** | 自动保存 `pending` **幂等**（已为 pending 不重复 setState） | `useAutoSaveSegments.test.ts` 可选 |

## 2. 实现要点

### P0a — `useSegmentDraftStore.ts`

```text
setDraft(key, text):
  - 始终更新 Map
  - notify 默认 true；input 路径可 set notify:false + scheduleEmit()
scheduleEmit():
  - 若已有 rAF 挂起 → return
  - rAF 内 emit() 一次
composition:
  - beginComposition 不 emit
  - endComposition 后 scheduleEmit() 一次
blur / flushSegmentTextDrafts:
  - 须 flushPendingEmit() 同步 emit，保证脏读正确
```

**禁止**：blur 前丢失最后一次 keystroke 的 notify。

### P0b/c — `useSegmentRowTextFieldController.ts` + `SegmentRowTextField.tsx`

```text
deferredText = useDeferredValue(liveText)
mirrorText = panelPreviewOpen ? liveText : deferredText   // 查找/纠错预览跟手
showCorrectableMirror 使用 mirrorText 渲染
text-transparent 仅当：showPanelHighlightMirror && panelPreviewOpen
  （或：聚焦时永不 transparent — 手测择优，acceptance H1）
```

### P0d — `useTranscriptFooterStats.ts`

- 订阅合并后的 emit，或内部 `useDeferredValue` / 100ms throttle
- `getCharCount` 逻辑不变（仍 `segmentsWithDraftsApplied`）

### P0e — `useAutoSaveSegments.ts`

- `scheduleAutoSave`：`autoSaveFooterStatus === 'pending'` 时跳过 `setAutoSaveFooterStatus('pending')`

## 3. 文件清单

| 文件 | 操作 |
|------|------|
| `apps/desktop/src/hooks/useSegmentDraftStore.ts` | 改 |
| `apps/desktop/src/hooks/useSegmentRowTextFieldEditing.ts` | 改（input → silent/setDraft） |
| `apps/desktop/src/hooks/useSegmentRowTextFieldController.ts` | 改（defer） |
| `apps/desktop/src/components/segmentRow/SegmentRowTextField.tsx` | 改（transparent 条件） |
| `apps/desktop/src/hooks/useTranscriptFooterStats.ts` | 改 |
| `apps/desktop/src/pages/useAutoSaveSegments.ts` | 改（可选 P0e） |
| `apps/desktop/src/hooks/segmentDraftStore.test.ts` | 扩 |
| `apps/desktop/src/hooks/useTranscriptFooterStats.test.ts` | 扩 |

## 4. 验证命令

```bash
npm run typecheck
npm run test -- apps/desktop/src/hooks/segmentDraftStore.test.ts apps/desktop/src/hooks/useTranscriptFooterStats.test.ts apps/desktop/src/pages/flushSegmentTextDrafts.test.ts apps/desktop/src/pages/useAutoSaveSegments.test.ts
node scripts/check-architecture-guard.mjs
```

手测：[`segment-text-input-p0-hand-test-checklist.md`](./segment-text-input-p0-hand-test-checklist.md)

## 5. 后续（P1 预告，本 Plan 不实施）

- 未选中 `readOnly` textarea，消除 div/textarea 切换
- `EditorSegmentList` 换段 `scrollIntoView` 改 `minimal`
- 虚拟化阈值 900 → 200

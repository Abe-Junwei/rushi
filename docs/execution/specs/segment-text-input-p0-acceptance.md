# Acceptance：语段正文输入路径 P0

> **Research**：[`segment-text-input-p0-research.md`](./segment-text-input-p0-research.md)  
> **Plan**：[`segment-text-input-p0-plan.md`](./segment-text-input-p0-plan.md)  
> **手测**：[`segment-text-input-p0-hand-test-checklist.md`](./segment-text-input-p0-hand-test-checklist.md)

## 能力—UI 状态矩阵

| 能力 | 输入中 | 失焦后 | `busy` | 查找/纠错面板开 |
|------|--------|--------|--------|-----------------|
| 正文可见字 | textarea **实字**（非透明） | 同左 | disabled | 实字；查找高亮 **跟手** |
| 错词下划线 | deferred（≤1 帧延迟可接受） | 及时显示 | 无镜像 | 面板高亮优先于错词镜像 |
| 页脚字数 | 节流更新，**最终一致** | 与草稿/落库一致 | — | — |
| 自动保存 | debounce 1.5s **不变** | 落库后 `saved` | 暂停 | — |
| 脏点 / 关闭拦截 | 有草稿仍提示 | blur 写 `segments[]` | — | — |
| IME 组字 | 组字期间不丢字、不闪 mirror | compositionend 后同步 | — | — |

## 手测门禁（摘要）

| ID | 场景 | 通过标准 |
|----|------|----------|
| H1 | 有纠错规则时长段打字 | 无明显逐字 lag；光标处始终看见实字 |
| H2 | 打开查找替换并输入 | 匹配高亮 **即时**；不错乱选区 |
| H3 | 中文 IME 组句 | 组字过程不跳字；上屏后错词线更新 |
| H4 | 快速输入 30s 后看页脚字数 | 与当前稿一致（允许 ≤200ms 延迟） |
| H5 | blur / 自动保存 / 重开文件 | 文本不丢；与 P0 前行为一致 |

完整步骤见 hand-test checklist。

## 自动化

- [x] `segmentDraftStore.test.ts`：合并 emit；composition；`flushPendingEmit`
- [x] `flushSegmentTextDrafts.test.ts`：仍绿
- [x] `useTranscriptFooterStats.test.ts`：草稿变更后字数最终正确
- [x] `segmentDirtyRead.test.ts`：仍绿
- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

## 签收

- [x] H1–H5 手测通过（2026-06-11）
- [x] 自动化全绿
- [x] 无新增 architecture hotspot 例外

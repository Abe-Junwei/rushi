# Plan：文稿点选 seek（听跳）

> **Research**：[transcript-click-seek-while-playing-research.md](./transcript-click-seek-while-playing-research.md)  
> **状态**：与采纳方案同步（点句即 seek，含暂停）

## 切片

1. `shouldSeekOnSegmentSelect`：`list` / `listAdvance` → true；`listKeyboard` → false  
2. `selectSegmentTransport`：shift/toggle 不 seek；list seek 前 `beginGlobalPlayback`  
3. `useTranscriptionLayerSelection`：仅 `listKeyboard` 调跟播 divert；注入 `beginGlobalPlayback`  
4. 导出 `beginGlobalPlayback`（`useProjectWaveform`）  
5. 更新 profile 测试、architecture guard、H1 交叉引用  

## 验证

```bash
cd apps/desktop && npx vitest run \
  src/utils/selectionRevealSeekPolicy.test.ts \
  src/pages/useTranscriptionLayerSelection.profile.test.ts
node scripts/check-architecture-guard.mjs
```

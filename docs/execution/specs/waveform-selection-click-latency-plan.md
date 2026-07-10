# Plan：语段点选延迟（SEL-1）

> **调研**（编码前必读）：[`waveform-selection-click-latency-research.md`](./waveform-selection-click-latency-research.md)
> **acceptance**：[`waveform-selection-click-latency-acceptance.md`](./waveform-selection-click-latency-acceptance.md)
> **架构**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) §选中时钟（SC1/SC2）
> **状态**：待编码（用户已确认方案）

---

## 0. 目标数据流（修复后）

```
pointer select (waveform | list)
  ├─ SC2 paintSelectionChrome / publishSelectionChrome   // 同步，~1ms
  ├─ reveal / seek（策略不变；决策读 chrome / display）
  └─ SC1 setSelectedIdxUi via startTransition             // 低优，不挡高亮

profile
  ├─ begin at selectSegmentAt entry
  ├─ spans: flushSelectedIdx, listScroll, listCommit, bandPaint, …
  └─ flush after list layout commit（含预览已同步路径）
```

---

## 1. 分片

### SEL-1a　profile 缺口

1. waveform 预览已同步路径：`selectionProfileScheduleFlush("waveform")`（已部分落地）+ 确保 `listCommit` 在 scrollKey 命中时仍标记。
2. `bandPaint` span 已接入 band canvas；验收手测须能看到。
3. 单测：parse/format 含 `bandPaint`；预览路径 flush 不丢 total。

### SEL-1b　SC1 transition（核心）

**落位**：`useSelectedIdxCommitter.ts`

- `waveform` / `list` / `waveformKeyboard`（非 burst）与 architecture 对齐：`startTransition(() => setSelectedIdxUi(...))`。
- `listKeyboard` burst 仍禁止逐步 SC1（既有 LKB）；keyup finalize 保持一次 transition。
- 空格 / seek / reveal：**禁止**读滞后 React `selectedIdx` 作决策；继续 chrome primary + display playhead。

**验证**：单测 committer 对 waveform/list 走 transition；手测高亮即时、起播不跳。

### SEL-1c　列表 reconcile 收窄（最小）

- 复用 LKB Phase 4：确认 `EditorSegmentList` / Workbench 不因 SC2-only 变化整表重渲染。
- 若 U11/U12 过大，本薄片只做「点选路径不强制同步 SC1」；U11/U12 记后续。

---

## 2. 明确不做

- 不改虚拟列表算法
- 不改 WR/WS-FPS 轨
- 不引入第二套选中 store

---

## 3. 执行时序

| 步 | 内容 | 闸门 |
|----|------|------|
| 1 | SEL-1a | profile 手测有 listCommit/bandPaint |
| 2 | SEL-1b | typecheck + test + 手测 62 段 |
| 3 | SEL-1c 能做则做 | 不阻塞 1b 签收 |

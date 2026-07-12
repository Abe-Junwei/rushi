# Acceptance：文稿点选 seek（听跳）

> **Research**：[transcript-click-seek-while-playing-research.md](./transcript-click-seek-while-playing-research.md)  
> **状态**：编码中

## 能力—UI 状态矩阵

| 能力 | 条件 | UI / 入口 | 期望 |
|------|------|-----------|------|
| 点句听跳 | list / listAdvance + 换句 | 文稿行 / meta | 选中 + seek 段首；playing 则续播 |
| 键盘导航 | listKeyboard | ↑↓ / Tab | 选中 + reveal；**不** seek |
| 多选 | shift / toggle | 文稿 | **不** seek |
| 段播中点他句 | scoped playing + list | 文稿 | seek + 解 bound → 全局续播 |
| 同句再点 | 同 idx | 文稿 | 不重复 seek |

## 自动化

- [x] `selectionRevealSeekPolicy.test.ts`
- [x] `useTranscriptionLayerSelection.profile.test.ts` — list/listAdvance seek；listKeyboard 不 seek
- [x] architecture-guard policy 断言更新

## 手测

1. [ ] 暂停点远处句：playhead 到段首
2. [ ] 全局播中点远处句：从该句续播
3. [ ] ↑↓：选中变、playhead 不动
4. [ ] 浮层段播中点他句：跳转并续播不被旧段尾截停
5. [ ] Shift 多选：不 seek

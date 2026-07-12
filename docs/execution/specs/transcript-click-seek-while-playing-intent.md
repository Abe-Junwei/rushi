# Intent：文稿点选 seek（听跳）

> **Research**：[transcript-click-seek-while-playing-research.md](./transcript-click-seek-while-playing-research.md)  
> **Plan**：[transcript-click-seek-while-playing-plan.md](./transcript-click-seek-while-playing-plan.md)  
> **Acceptance**：[transcript-click-seek-while-playing-acceptance.md](./transcript-click-seek-while-playing-acceptance.md)  
> **状态**：已完成（自动化 ✅；手测待签）

## 意图

文稿单击 / 连点另一语段 → 播放头跳到该段首（播放中则续播）。↑↓ / Tab 仍不 seek，便于改稿保书签。

## 范围

| 薄片 | 交付 |
|------|------|
| 本薄片 | `list`/`listAdvance` seek；解段播 bound；跟播不 divert；测试 + guard + 文档 |
| 不做 | 词级 seek；listKeyboard seek；修饰键例外（后续可选） |

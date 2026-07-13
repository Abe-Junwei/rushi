# Acceptance：超长录音语段可操作缩放

> **Research**：[waveform-segment-operable-zoom-research.md](./waveform-segment-operable-zoom-research.md)  
> **Intent**：[waveform-segment-operable-zoom-intent.md](./waveform-segment-operable-zoom-intent.md)  
> **状态**：自动化已绿；手测待做  

## 能力—UI 矩阵

| 能力 | 条件 | UI | 期望 |
|------|------|-----|------|
| 长音频默认 zoom | duration ≥ 30min，换文件 reset | 波形语段条 | 视口约 45s；2s 段绘制宽 ≳ 40px（1200px 视口） |
| 适配语段 | 选中口语段 + 长音频 | Focus 按钮 | layout px/s 可达 layout soft-cap，不被 `40960/dur` 压回 |
| 整段可见 | 用户点 Maximize | 时间轴贴视口 | 仍为 fit-all（语段可极窄，总览用途） |
| 极窄命中 | 绘制宽 < 最小命中 | 指针 | 仍可点中；边柄不整段吞没 |
| 投影不变量 | 任意 zoom | overlay / ruler / seek | `time ↔ px` 仍线性单一投影 |

## 自动化

- [x] `pxPerSec*.test.ts`：3h · 1200px 默认与 fit-selection layout 数值  
- [x] `waveformSegmentBounds` 命中扩容  
- [x] `waveformTimelineMetrics` 使用 layout clamp  

## 手测

1. [ ] 打开 ≈3h 文件：默认可见约数十秒，2s 级语段可拖边界  
2. [ ] 「适配语段」进一步放大选中句，不被立刻打回  
3. [ ] 「整段可见」仍可总览全轨  
4. [ ] 横滚 / minimap / 播放跟滚无明显错位  

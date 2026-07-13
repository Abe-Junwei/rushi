# Acceptance：视口窗口 peaks 细节

> **Research**：[waveform-viewport-peaks-detail-research.md](./waveform-viewport-peaks-detail-research.md)  
> **Intent**：[waveform-viewport-peaks-detail-intent.md](./waveform-viewport-peaks-detail-intent.md)  
> **状态**：自动化已绿；手测待做  

## 能力—UI 矩阵

| 能力 | 条件 | UI | 期望 |
|------|------|-----|------|
| 高 zoom 细节 | 3h · 视口约 14s | 主波形 canvas | 视口内列数 ≈ 视口 CSS 宽（或 LOD 允许的最大值下采样），无明显 20px 级阶梯块 |
| 滚动 | 横滚出 buffer | 同上 | 窗口重提峰；无空白久挂 |
| LOD 上限 | 极高 zoom 超 L3 | 同上 | 受 800 pps 限制，可仍略块，但不回退到整轨 3.8 pps |
| 投影 | 任意 zoom | overlay / seek | 时间投影不变 |

## 自动化

- [x] `extractViewportWindowPeaks`：3h 窗口列数断言  
- [x] draw：窗口本地 peaks 1:1（canvas 以 `timelineWidthPx=cssW` 绘制）  
- [x] PeakCache `getViewportWindowPeaks` 冒烟  

## 手测

1. [ ] 打开 ≈3h 文件，默认或放大到约 10–20s 入视口：波形柱细密可读  
2. [ ] 横滚流畅，无明显「突然变糊再变清」以外的空白  
3. [ ] 语段拖边界 / 播放头仍对齐  

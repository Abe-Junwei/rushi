# Intent：视口窗口 peaks 细节（长音频高 zoom）

> **Research**：[waveform-viewport-peaks-detail-research.md](./waveform-viewport-peaks-detail-research.md)  
> **Acceptance**：[waveform-viewport-peaks-detail-acceptance.md](./waveform-viewport-peaks-detail-acceptance.md)  
> **状态**：编码完成（自动化）；手测待签  

## 意图

长音频高 layout zoom 时，主波形按**视口窗口**从 PeakCache LOD 取峰并 1:1 绘制，消除整轨 40960 列拉伸造成的粗块。

## 范围

| 薄片 | 交付 |
|------|------|
| V1 | `extractViewportWindowPeaks` 纯函数（LOD → 窗口列） |
| V2 | PeakCache + ViewportPeaksCanvas 接线 |
| V3 | draw 支持窗口本地 peaks；定向测试 + architecture 一句 |

## 不做

- 抬高整轨 `MAX_WAVESURFER_PEAK_COLUMNS` 作主波形细节  
- 新增 LOD 档位 / 改 Rust 生成  
- 非线性时间轴  
